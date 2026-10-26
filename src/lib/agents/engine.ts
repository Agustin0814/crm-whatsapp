import "server-only";
import { isWindowOpen } from "@/lib/conversation-window";
import { applyTemplate } from "@/lib/crm/templates";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { WhatsAppApiError } from "@/lib/whatsapp/send";
import { DEFAULT_LIMITS, isQuickReplyUsable, parseAgentConfig, type AgentConfig, type AgentLimits } from "./config";
import {
  AGENT_TIME_ZONE,
  estimateCostUsd,
  isScheduleActive,
  matchEscalationTopic,
  scopeBlockReason,
} from "./guards";
import { AGENT_TOOLS, buildHistory, buildSystemPrompt, HISTORY_LIMIT } from "./prompt";
import { getModelProvider, ModelProviderError } from "./provider";
import { AgentSendError, sendAgentText } from "./send";

// Motor común de los agentes. Todo límite y regla de seguridad se aplica aquí
// (servidor, cliente admin). Cada decisión queda en agent_usage_log.

type AdminClient = ReturnType<typeof createAdminClient>;
type Run = Tables<"agent_scheduled_runs">;
type Locked = Tables<"agent_locked_config">;
type Outcome = "sent" | "suggested" | "skipped" | "handoff" | "error" | "blocked_by_limit";

type Usage = { inputTokens: number; outputTokens: number };
const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0 };

/** Texto máximo de una respuesta libre del agente (corta por diseño). */
const MAX_REPLY_CHARS = 1000;

// ---------------------------------------------------------------------------
// Fechas en la zona del negocio
// ---------------------------------------------------------------------------

/**
 * Inicio del día y del mes en America/Hermosillo. Sonora no tiene horario de
 * verano (UTC−7 todo el año), así que el desfase es fijo.
 */
function periodStarts(now: Date = new Date()): { day: string; month: string; monthDate: string } {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: AGENT_TIME_ZONE }).format(now); // AAAA-MM-DD
  const monthDate = `${local.slice(0, 7)}-01`;
  return {
    day: new Date(`${local}T00:00:00-07:00`).toISOString(),
    month: new Date(`${monthDate}T00:00:00-07:00`).toISOString(),
    monthDate,
  };
}

// ---------------------------------------------------------------------------
// Programación (desde el webhook)
// ---------------------------------------------------------------------------

/**
 * Programa la respuesta de cada agente habilitado a un mensaje entrante.
 * Si ya hay una corrida pendiente en la conversación, la pospone (una sola
 * respuesta aunque el cliente mande varios mensajes seguidos).
 * Devuelve true si alguna corrida quedó para ahora (retraso 0).
 * Nunca lanza: un error aquí no debe afectar el guardado del mensaje.
 */
export async function scheduleAgentsForInbound(
  supabase: AdminClient,
  input: { conversationId: string; messageId: string },
): Promise<boolean> {
  try {
    const { data: agents, error } = await supabase
      .from("agents")
      .select("id, config, agent_locked_config(kill_switch, delay_seconds_min, delay_seconds_max)")
      .eq("enabled", true);
    if (error || !agents?.length) return false;

    const { data: conversation } = await supabase
      .from("conversations")
      .select("agent_paused")
      .eq("id", input.conversationId)
      .maybeSingle();
    if (!conversation || conversation.agent_paused) return false;

    let immediate = false;
    for (const agent of agents) {
      const locked = agent.agent_locked_config;
      if (!locked || locked.kill_switch) continue;
      // La espera (segundos) se recorta otra vez al rango del proveedor.
      const config = parseAgentConfig(agent.config, {
        ...DEFAULT_LIMITS,
        delay_seconds_min: locked.delay_seconds_min,
        delay_seconds_max: locked.delay_seconds_max,
      });
      const runAt = new Date(Date.now() + config.delay_seconds * 1000).toISOString();
      const { error: scheduleError } = await supabase.rpc("schedule_agent_run", {
        p_agent_id: agent.id,
        p_conversation_id: input.conversationId,
        p_message_id: input.messageId,
        p_run_at: runAt,
      });
      if (scheduleError) {
        console.error(`[agents] No se pudo programar la respuesta: ${scheduleError.message}`);
        continue;
      }
      if (config.delay_seconds === 0) immediate = true;
    }
    return immediate;
  } catch (error) {
    console.error(`[agents] Error al programar: ${describe(error)}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Procesador (cron cada minuto o inmediato)
// ---------------------------------------------------------------------------

/**
 * Toma las corridas vencidas (bloqueo por fila: dos procesadores a la vez no
 * responden dos veces) y ejecuta cada una. Idempotente.
 */
export async function processDueRuns(supabase: AdminClient, limit = 10): Promise<{ processed: number }> {
  const { data: runs, error } = await supabase.rpc("claim_agent_runs", { p_limit: limit });
  if (error) throw new Error(`No se pudieron tomar las corridas: ${error.message}`);

  for (const run of runs ?? []) {
    let status: "done" | "skipped" = "skipped";
    let reason = "Sin acción";
    try {
      const result = await executeRun(supabase, run);
      status = result.acted ? "done" : "skipped";
      reason = result.reason;
    } catch (error) {
      status = "done";
      reason = "Error inesperado";
      console.error(`[agents] Error en la corrida ${run.id}: ${describe(error)}`);
      await logUsage(supabase, { run, outcome: "error", reason: "Error inesperado", usage: NO_USAGE });
    }
    await supabase
      .from("agent_scheduled_runs")
      .update({ status, reason, updated_at: new Date().toISOString() })
      .eq("id", run.id)
      .eq("status", "running");
  }
  return { processed: runs?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// Una corrida
// ---------------------------------------------------------------------------

type RunResult = { acted: boolean; reason: string };

type RunContext = {
  supabase: AdminClient;
  run: Run;
  agentId: string;
  mode: "suggestion" | "automatic";
  config: AgentConfig;
  locked: Locked;
  conversation: {
    id: string;
    last_inbound_at: string | null;
    agent_consecutive_count: number;
  };
  contact: {
    name: string | null;
    wa_id: string | null;
    phone: string | null;
    company: string | null;
  };
};

async function executeRun(supabase: AdminClient, run: Run): Promise<RunResult> {
  // --- Agente y capa bloqueada ---
  const { data: agent } = await supabase
    .from("agents")
    .select("id, enabled, mode, config, agent_locked_config(*)")
    .eq("id", run.agent_id)
    .maybeSingle();
  const locked = agent?.agent_locked_config ?? null;
  if (!agent || !locked) return { acted: false, reason: "Agente no encontrado" };
  if (!agent.enabled) return skip(supabase, run, "Agente apagado", false);
  if (locked.kill_switch) return block(supabase, run, "Detenido por el proveedor (kill switch)");

  const limits: AgentLimits = {
    ...DEFAULT_LIMITS,
    max_consecutive_max: locked.max_consecutive_ceiling,
    daily_cap_max: locked.daily_cap_ceiling,
    delay_seconds_min: locked.delay_seconds_min,
    delay_seconds_max: locked.delay_seconds_max,
  };
  const config = parseAgentConfig(agent.config, limits);
  const mode = agent.mode === "automatic" ? "automatic" : "suggestion";

  // --- Conversación y contacto ---
  const { data: conversation } = await supabase
    .from("conversations")
    .select(
      "id, last_inbound_at, agent_paused, agent_consecutive_count, human_seen_at, contacts(name, wa_id, phone, company, classification, contact_tags(tag_id))",
    )
    .eq("id", run.conversation_id)
    .maybeSingle();
  const contact = conversation?.contacts;
  if (!conversation || !contact) return skip(supabase, run, "Conversación no encontrada", false);
  if (conversation.agent_paused) return skip(supabase, run, "Agente pausado en este chat");
  if (!isWindowOpen(conversation.last_inbound_at)) return skip(supabase, run, "Fuera de la ventana de 24 h");
  if (!contact.wa_id) return skip(supabase, run, "Contacto sin WhatsApp");

  // --- ¿Ya respondió alguien? ---
  const { data: latest } = await supabase
    .from("messages")
    .select("id, direction, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest || latest.direction !== "inbound") return skip(supabase, run, "Ya hubo una respuesta");

  const { data: trigger } = run.trigger_message_id
    ? await supabase.from("messages").select("id, body, created_at").eq("id", run.trigger_message_id).maybeSingle()
    : { data: null };
  const triggerAt = trigger?.created_at ?? latest.created_at;

  // En automático, si una persona abrió el chat durante el retraso, no se responde.
  if (mode === "automatic" && conversation.human_seen_at && conversation.human_seen_at >= triggerAt) {
    return skip(supabase, run, "Una persona abrió el chat");
  }

  // --- Alcance y horario ---
  const scopeReason = scopeBlockReason(config.scope, {
    classification: contact.classification,
    tagIds: contact.contact_tags.map((t) => t.tag_id),
  });
  if (scopeReason) return skip(supabase, run, scopeReason);
  if (!isScheduleActive(config.schedule)) return skip(supabase, run, "Fuera del horario del asistente");

  const ctx: RunContext = {
    supabase,
    run,
    agentId: agent.id,
    mode,
    config,
    locked,
    conversation,
    contact,
  };

  // --- Límite de respuestas seguidas sin intervención humana ---
  if (conversation.agent_consecutive_count >= config.limits.max_consecutive) {
    return handoff(ctx, `Límite de ${config.limits.max_consecutive} respuestas seguidas`, NO_USAGE, "limit_consecutive");
  }

  // --- Topes diario y mensual ---
  const periods = periodStarts();
  const { count: todayCount } = await supabase
    .from("agent_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .gte("created_at", periods.day)
    .in("outcome", ["sent", "suggested", "handoff"]);
  if ((todayCount ?? 0) >= config.limits.daily_cap) {
    if (config.alerts.on_daily_cap) {
      await alertOnce(supabase, agent.id, "daily_cap", "admin", periods.day, `El asistente llegó al tope diario de ${config.limits.daily_cap} respuestas.`);
    }
    return block(supabase, run, `Tope diario (${config.limits.daily_cap})`);
  }

  const { data: month } = await supabase
    .from("agent_usage_monthly")
    .select("input_tokens, output_tokens")
    .eq("agent_id", agent.id)
    .eq("month", periods.monthDate)
    .maybeSingle();
  const monthTokens = (month?.input_tokens ?? 0) + (month?.output_tokens ?? 0);
  if (monthTokens >= locked.monthly_token_cap) {
    await alertOnce(supabase, agent.id, "token_cap", "superadmin", periods.month, `Se alcanzó el tope mensual de ${locked.monthly_token_cap.toLocaleString("es-MX")} tokens. El asistente se detuvo hasta el próximo mes.`);
    return block(supabase, run, "Tope mensual de tokens");
  }
  // Aviso al cliente al acercarse al límite del mes (umbral del proveedor).
  if (
    config.alerts.on_monthly_threshold &&
    locked.monthly_token_cap > 0 &&
    monthTokens >= (locked.monthly_token_cap * locked.monthly_alert_threshold_pct) / 100
  ) {
    await alertOnce(
      supabase,
      agent.id,
      "monthly_threshold",
      "admin",
      periods.month,
      `${config.display_name} ya usó el ${locked.monthly_alert_threshold_pct} % de su límite del mes.`,
    );
  }

  // --- Temas de escalamiento (sin gastar tokens) ---
  const topic = trigger?.body ? matchEscalationTopic(trigger.body, locked.escalation_topics) : null;
  if (topic) return handoff(ctx, `Tema de escalamiento: ${topic}`, NO_USAGE);

  // --- Respuestas rápidas permitidas e historial ---
  // Regla efectiva: el proveedor no la marcó «solo humano» Y el cliente la encendió.
  const { data: quickReplies } = await supabase
    .from("quick_replies")
    .select("id, shortcut, body, when_to_use, agent_permission")
    .neq("agent_permission", "human_only")
    .order("shortcut");
  const allowedReplies = (quickReplies ?? []).filter((q) => isQuickReplyUsable(q, config));

  const { data: recent } = await supabase
    .from("messages")
    .select("direction, type, body")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = buildHistory(
    (recent ?? []).reverse().map((m) => ({ direction: m.direction === "inbound" ? "inbound" : "outbound", type: m.type, body: m.body })),
  );

  const system = buildSystemPrompt({
    lockedSystemPrompt: locked.system_prompt,
    lockedSafetyRules: locked.safety_rules,
    businessInfo: locked.business_info,
    escalationTopics: locked.escalation_topics,
    config,
    quickReplies: allowedReplies,
    contactFirstName: contact.name?.trim().split(/\s+/)[0] || null,
  });
  const tools = AGENT_TOOLS.filter(
    (t) => locked.allowed_tools.includes(t.name) && (t.name !== "enviar_respuesta_rapida" || allowedReplies.length > 0),
  );

  // --- Modelo ---
  let result;
  try {
    result = await getModelProvider().generateReply({
      system,
      messages: history,
      tools,
      limits: {
        model: locked.model,
        maxOutputTokens: locked.max_output_tokens,
        reasoningEffort: (["minimal", "low", "medium", "high"] as const).find((e) => e === locked.reasoning_effort) ?? "low",
        temperature: locked.temperature === null ? null : Number(locked.temperature),
      },
    });
  } catch (error) {
    const usage = error instanceof ModelProviderError ? error.usage : NO_USAGE;
    const reason = error instanceof ModelProviderError ? error.message : "Error del modelo";
    await logUsage(supabase, { run, outcome: "error", reason, usage, model: locked.model, locked });
    // Los errores técnicos solo los ve el proveedor.
    await alertOnce(supabase, agent.id, "error", "superadmin", periods.day, "El asistente tuvo errores al generar respuestas hoy. Revisa el registro de actividad.");
    return { acted: true, reason };
  }

  const usage = result.usage;
  const call = result.toolCall ?? (result.text ? { name: "responder_texto_corto", arguments: { texto: result.text } } : null);
  if (!call || !locked.allowed_tools.includes(call.name)) {
    await logUsage(supabase, { run, outcome: "error", reason: "El modelo no eligió una herramienta permitida", usage, model: result.model, locked });
    return { acted: true, reason: "Herramienta no permitida" };
  }

  switch (call.name) {
    case "transferir_a_humano": {
      const motivo = typeof call.arguments.motivo === "string" ? call.arguments.motivo.trim().slice(0, 200) : "";
      return handoff(ctx, motivo ? `El asistente transfirió: ${motivo}` : "El asistente transfirió a una persona", usage, "handoff", result.model);
    }
    case "enviar_respuesta_rapida": {
      const shortcut = typeof call.arguments.shortcut === "string" ? call.arguments.shortcut.trim().replace(/^\//, "") : "";
      const reply = allowedReplies.find((q) => q.shortcut === shortcut);
      if (!reply) {
        await logUsage(supabase, { run, outcome: "error", reason: `Respuesta rápida no permitida: ${shortcut || "(vacía)"}`, usage, model: result.model, locked });
        return { acted: true, reason: "Respuesta rápida no permitida" };
      }
      return deliver(ctx, {
        text: applyTemplate(reply.body, contact),
        quickReplyId: reply.id,
        // «Con aprobación»: siempre queda como sugerencia, aun en automático.
        forceSuggestion: reply.agent_permission === "approval",
        usage,
        model: result.model,
        reason: `Respuesta rápida /${reply.shortcut}`,
      });
    }
    default: {
      const texto = typeof call.arguments.texto === "string" ? call.arguments.texto.trim().slice(0, MAX_REPLY_CHARS) : "";
      if (!texto) {
        await logUsage(supabase, { run, outcome: "error", reason: "Respuesta vacía", usage, model: result.model, locked });
        return { acted: true, reason: "Respuesta vacía" };
      }
      return deliver(ctx, { text: texto, quickReplyId: null, forceSuggestion: false, usage, model: result.model, reason: "Texto corto" });
    }
  }
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

/**
 * Entrega una respuesta: en modo sugerencia (o si se exige aprobación) deja
 * un borrador para el operador; en automático la envía por WhatsApp.
 */
async function deliver(
  ctx: RunContext,
  input: {
    text: string;
    quickReplyId: string | null;
    forceSuggestion: boolean;
    usage: Usage;
    model?: string;
    reason: string;
    outcome?: "handoff";
  },
): Promise<RunResult> {
  const { supabase, run } = ctx;
  const asSuggestion = ctx.mode === "suggestion" || input.forceSuggestion;

  if (asSuggestion) {
    await supabase
      .from("agent_suggestions")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("conversation_id", ctx.conversation.id)
      .eq("status", "pending");
    const { error } = await supabase.from("agent_suggestions").insert({
      agent_id: ctx.agentId,
      conversation_id: ctx.conversation.id,
      trigger_message_id: run.trigger_message_id,
      body: input.text,
      quick_reply_id: input.quickReplyId,
    });
    if (error) {
      await logUsage(supabase, { run, outcome: "error", reason: "No se pudo guardar la sugerencia", usage: input.usage, model: input.model, locked: ctx.locked });
      return { acted: true, reason: "No se pudo guardar la sugerencia" };
    }
    await logUsage(supabase, { run, outcome: input.outcome ?? "suggested", reason: input.reason, usage: input.usage, model: input.model, locked: ctx.locked });
    return { acted: true, reason: input.reason };
  }

  try {
    const { messageId } = await sendAgentText(supabase, {
      conversationId: ctx.conversation.id,
      waId: ctx.contact.wa_id,
      lastInboundAt: ctx.conversation.last_inbound_at,
      text: input.text,
      agentId: ctx.agentId,
      senderId: null,
    });
    await logUsage(supabase, { run, outcome: input.outcome ?? "sent", reason: input.reason, usage: input.usage, model: input.model, locked: ctx.locked, messageId });
    return { acted: true, reason: input.reason };
  } catch (error) {
    const reason =
      error instanceof AgentSendError
        ? error.message
        : error instanceof WhatsAppApiError
          ? `WhatsApp rechazó el envío (${error.code ?? "?"})`
          : "No se pudo enviar";
    await logUsage(supabase, { run, outcome: "error", reason, usage: input.usage, model: input.model, locked: ctx.locked });
    return { acted: true, reason };
  }
}

/**
 * Transfiere a una persona: entrega el mensaje de traspaso del proveedor,
 * pausa el agente en el chat, asigna (si el proveedor lo configuró) y avisa.
 */
async function handoff(
  ctx: RunContext,
  reason: string,
  usage: Usage,
  pauseReason: "handoff" | "limit_consecutive" = "handoff",
  model?: string,
): Promise<RunResult> {
  const { supabase, config, locked } = ctx;
  const result = await deliver(ctx, {
    text: locked.handoff_message,
    quickReplyId: null,
    forceSuggestion: false,
    usage,
    model,
    reason,
    outcome: "handoff",
  });

  // El trigger de conversations no reasigna la pausa si ya viene pausada.
  await supabase
    .from("conversations")
    .update({
      agent_paused: true,
      agent_paused_reason: pauseReason,
      ...(locked.handoff_assign_to ? { assigned_to: locked.handoff_assign_to } : {}),
    })
    .eq("id", ctx.conversation.id);

  if (config.alerts.on_handoff) {
    const name = ctx.contact.name?.trim() || "un contacto";
    await supabase.from("agent_alerts").insert({
      agent_id: ctx.agentId,
      conversation_id: ctx.conversation.id,
      kind: "handoff",
      audience: "admin",
      message: `${config.display_name} pasó a una persona la conversación con ${name}: ${reason}`,
    });
  }
  return { ...result, reason };
}

async function skip(supabase: AdminClient, run: Run, reason: string, log = true): Promise<RunResult> {
  if (log) await logUsage(supabase, { run, outcome: "skipped", reason, usage: NO_USAGE });
  return { acted: false, reason };
}

async function block(supabase: AdminClient, run: Run, reason: string): Promise<RunResult> {
  await logUsage(supabase, { run, outcome: "blocked_by_limit", reason, usage: NO_USAGE });
  return { acted: false, reason };
}

async function logUsage(
  supabase: AdminClient,
  input: {
    run: Run;
    outcome: Outcome;
    reason: string;
    usage: Usage;
    model?: string;
    locked?: Locked;
    messageId?: string;
  },
): Promise<void> {
  const cost = input.locked
    ? estimateCostUsd(input.usage, {
        input_price_per_mtok: Number(input.locked.input_price_per_mtok),
        output_price_per_mtok: Number(input.locked.output_price_per_mtok),
      })
    : 0;
  const { error } = await supabase.from("agent_usage_log").insert({
    agent_id: input.run.agent_id,
    conversation_id: input.run.conversation_id,
    message_id: input.messageId ?? null,
    run_id: input.run.id,
    model: input.model ?? input.locked?.model ?? null,
    input_tokens: input.usage.inputTokens,
    output_tokens: input.usage.outputTokens,
    est_cost_usd: cost,
    outcome: input.outcome,
    reason: input.reason.slice(0, 300),
  });
  if (error) console.error(`[agents] No se pudo registrar el uso: ${error.message}`);
}

/** Crea una alerta de este tipo solo si no hay otra desde `since`. */
async function alertOnce(
  supabase: AdminClient,
  agentId: string,
  kind: "daily_cap" | "token_cap" | "monthly_threshold" | "error",
  audience: "admin" | "superadmin",
  since: string,
  message: string,
): Promise<void> {
  const { count } = await supabase
    .from("agent_alerts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("kind", kind)
    .gte("created_at", since);
  if ((count ?? 0) > 0) return;
  await supabase.from("agent_alerts").insert({ agent_id: agentId, kind, audience, message });
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) return String((error as { message: unknown }).message);
  return "desconocido";
}
