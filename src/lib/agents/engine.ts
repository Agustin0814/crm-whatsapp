import "server-only";
import { isWindowOpen } from "@/lib/conversation-window";
import { applyTemplate } from "@/lib/crm/templates";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { WhatsAppApiError } from "@/lib/whatsapp/send";
import { DEFAULT_LIMITS, isQuickReplyUsable, parseAgentConfig, type AgentConfig, type AgentLimits } from "./config";
import {
  currentBurst,
  estimateCostUsd,
  isScheduleActive,
  matchEscalationTopic,
  scopeBlockReason,
} from "./guards";
import {
  AGENT_TOOLS,
  buildHistory,
  buildSystemPrompt,
  buildUnansweredTurn,
  HISTORY_LIMIT,
  MAX_ACTIONS_PER_RUN,
  PREVIOUS_REPLIES_LIMIT,
  type PromptMessage,
} from "./prompt";
import { getModelProvider, ModelProviderError, type ChatTurn } from "./provider";
import {
  parseReplyPlan,
  RESPONDER_TOOL,
  retryNotice,
  TOOL_QUICK_REPLY,
  TOOL_TEXT,
  TOOL_TRANSFER,
  validateReplyPlan,
  type CoverageEntry,
  type PlanValidation,
} from "./reply-plan";
import { executeNotesRun, scheduleNotesForHandoff, scheduleNotesForInbound } from "./notes-engine";
import { AgentSendError, sendAgentText } from "./send";
import { alertOnce, describe, periodStarts, type AdminClient } from "./shared";

// Motor común de los agentes. Todo límite y regla de seguridad se aplica aquí
// (servidor, cliente admin). Cada decisión queda en agent_usage_log.

type Run = Tables<"agent_scheduled_runs">;
type Locked = Tables<"agent_locked_config">;
type Outcome = "sent" | "suggested" | "skipped" | "handoff" | "error" | "blocked_by_limit";

type Usage = { inputTokens: number; outputTokens: number };
const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0 };

/** Texto máximo de una respuesta libre del agente (corta por diseño). */
const MAX_REPLY_CHARS = 1000;

/** Pausa entre mensajes de una misma corrida, para que lleguen en orden (ms). */
export const PART_PAUSE_MS = 1500;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Una parte de la respuesta (un mensaje). */
export type ReplyPart = { text: string; quickReplyId: string | null };

// ---------------------------------------------------------------------------
// Programación (desde el webhook): espera por inactividad
// ---------------------------------------------------------------------------

/**
 * Programa la respuesta de cada agente habilitado a un mensaje entrante.
 * Espera por inactividad: cada mensaje nuevo reinicia la espera del cliente,
 * sin pasar del tope del proveedor (`max_wait_seconds`) desde el primer
 * mensaje sin responder. Hay UNA sola corrida pendiente por chat (la base).
 * Devuelve true si alguna corrida quedó para ahora (espera 0).
 * Nunca lanza: un error aquí no debe afectar el guardado del mensaje.
 */
export async function scheduleAgentsForInbound(
  supabase: AdminClient,
  input: { conversationId: string; messageId: string },
): Promise<boolean> {
  try {
    const { data: all, error } = await supabase
      .from("agents")
      .select("id, kind, config, agent_locked_config(kill_switch, delay_seconds_min, delay_seconds_max, max_wait_seconds, daily_cap_ceiling)")
      .eq("enabled", true);
    if (error || !all?.length) return false;

    // Asistente de notas: no depende de la pausa del chat (anota también chats
    // atendidos por personas). Su espera es de minutos: nunca es inmediata.
    for (const agent of all.filter((a) => a.kind === "notes")) {
      await scheduleNotesForInbound(supabase, agent, input);
    }

    const agents = all.filter((a) => a.kind === "responder");
    if (!agents.length) return false;
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
      const delay = await scheduleRun(supabase, {
        agentId: agent.id,
        conversationId: input.conversationId,
        messageId: input.messageId,
        rawConfig: agent.config,
        locked,
      });
      if (delay === 0) immediate = true;
    }
    return immediate;
  } catch (error) {
    console.error(`[agents] Error al programar: ${describe(error)}`);
    return false;
  }
}

/** Programa o reprograma la corrida de un chat. Devuelve la espera usada (o null si falló). */
async function scheduleRun(
  supabase: AdminClient,
  input: {
    agentId: string;
    conversationId: string;
    messageId: string | null;
    rawConfig: Json;
    locked: Pick<Locked, "delay_seconds_min" | "delay_seconds_max" | "max_wait_seconds">;
  },
): Promise<number | null> {
  // La espera (segundos) se recorta otra vez al rango del proveedor.
  const config = parseAgentConfig(input.rawConfig, {
    ...DEFAULT_LIMITS,
    delay_seconds_min: input.locked.delay_seconds_min,
    delay_seconds_max: input.locked.delay_seconds_max,
  });
  const { error } = await supabase.rpc("schedule_agent_run", {
    p_agent_id: input.agentId,
    p_conversation_id: input.conversationId,
    p_message_id: input.messageId as string,
    p_delay_seconds: config.delay_seconds,
    p_max_wait_seconds: input.locked.max_wait_seconds,
  });
  if (error) {
    console.error(`[agents] No se pudo programar la respuesta: ${error.message}`);
    return null;
  }
  return config.delay_seconds;
}

// ---------------------------------------------------------------------------
// Procesador (cron cada 10 s o inmediato)
// ---------------------------------------------------------------------------

/**
 * Toma las corridas vencidas (bloqueo por fila: dos procesadores a la vez no
 * responden dos veces) y ejecuta cada una. Idempotente.
 */
export async function processDueRuns(supabase: AdminClient, limit = 10): Promise<{ processed: number }> {
  const { data: runs, error } = await supabase.rpc("claim_agent_runs", { p_limit: limit });
  if (error) throw new Error(`No se pudieron tomar las corridas: ${error.message}`);
  if (!runs?.length) return { processed: 0 };

  // Cada corrida se ejecuta con el motor de su tipo de agente.
  const { data: kinds } = await supabase.from("agents").select("id, kind").in("id", [...new Set(runs.map((r) => r.agent_id))]);
  const kindOf = new Map((kinds ?? []).map((a) => [a.id, a.kind]));
  const notesRuns = runs.filter((r) => kindOf.get(r.agent_id) === "notes");
  const replyRuns = runs.filter((r) => kindOf.get(r.agent_id) !== "notes");

  // Las respuestas, en orden como siempre; las pasadas de notas (chats
  // distintos, sin envíos) en paralelo, de pocas en pocas.
  const replies = (async () => {
    for (const run of replyRuns) await finishRun(supabase, run, () => executeRun(supabase, run));
  })();
  const notes = (async () => {
    for (let i = 0; i < notesRuns.length; i += NOTES_CONCURRENCY) {
      await Promise.all(notesRuns.slice(i, i + NOTES_CONCURRENCY).map((run) => finishRun(supabase, run, () => executeNotesRun(supabase, run))));
    }
  })();
  await Promise.all([replies, notes]);
  return { processed: runs.length };
}

/** Pasadas de notas simultáneas en un mismo tick. */
const NOTES_CONCURRENCY = 4;

/** Ejecuta una corrida y la cierra (de `running` a `done`/`skipped`). */
async function finishRun(supabase: AdminClient, run: Run, execute: () => Promise<RunResult>): Promise<void> {
  let status: "done" | "skipped" = "skipped";
  let reason = "Sin acción";
  try {
    const result = await execute();
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

// ---------------------------------------------------------------------------
// Mensajes sin responder (snapshot)
// ---------------------------------------------------------------------------

type InboundRow = { id: string; type: string; body: string | null; created_at: string };

/**
 * Mensajes del cliente posteriores al último instante respondido: el último
 * saliente de una persona o lo que vio el modelo al generar su último mensaje
 * (`messages.agent_answered_through`). NO se compara con la hora de envío.
 */
export async function loadUnanswered(
  supabase: AdminClient,
  conversationId: string,
): Promise<{ answeredThrough: string | null; unanswered: InboundRow[] }> {
  const { data: answeredThrough, error } = await supabase.rpc("agent_answered_through", {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error(`No se pudo leer lo respondido: ${error.message}`);
  let query = supabase
    .from("messages")
    .select("id, type, body, created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: true })
    .limit(30);
  if (answeredThrough) query = query.gt("created_at", answeredThrough);
  const { data } = await query;
  return { answeredThrough: answeredThrough ?? null, unanswered: data ?? [] };
}

/** ¿Llegó algún mensaje del cliente después del snapshot? */
async function newerInbound(supabase: AdminClient, conversationId: string, seenAt: string): Promise<InboundRow | null> {
  const { data } = await supabase
    .from("messages")
    .select("id, type, body, created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .gt("created_at", seenAt)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Una corrida
// ---------------------------------------------------------------------------

type RunResult = { acted: boolean; reason: string };

type RunContext = {
  supabase: AdminClient;
  run: Run;
  agentId: string;
  agentConfigRaw: Json;
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
  /** Último mensaje del cliente que vio esta corrida y cuántos atendió. */
  snapshot: { lastInboundId: string; lastInboundAt: string; handled: number };
  /** Cobertura de preguntas y reintento (solo depuración, va a agent_usage_log). */
  debug?: { coverage: CoverageEntry[]; retried: boolean };
};

async function executeRun(supabase: AdminClient, run: Run): Promise<RunResult> {
  // --- Agente y capa del proveedor ---
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

  // --- Snapshot: mensajes del cliente sin responder (solo la ráfaga actual) ---
  const { unanswered: allUnanswered } = await loadUnanswered(supabase, conversation.id);
  // Un mensaje viejo sin responder (de hace horas) no entra al bloque «sin
  // responder»: queda como contexto en el historial.
  const unanswered = currentBurst(allUnanswered, locked.burst_gap_seconds);
  const last = unanswered.at(-1);
  if (!last) return skip(supabase, run, "Ya se respondieron todos los mensajes");
  await supabase
    .from("agent_scheduled_runs")
    .update({ seen_inbound_at: last.created_at, seen_message_id: last.id })
    .eq("id", run.id);
  const snapshot = { lastInboundId: last.id, lastInboundAt: last.created_at, handled: unanswered.length };

  // En automático, si una persona abrió el chat después del último mensaje, no se responde.
  if (mode === "automatic" && conversation.human_seen_at && conversation.human_seen_at >= last.created_at) {
    return skip(supabase, run, "Una persona abrió el chat", true, snapshot.handled);
  }

  // --- Alcance y horario ---
  const scopeReason = scopeBlockReason(config.scope, {
    classification: contact.classification,
    tagIds: contact.contact_tags.map((t) => t.tag_id),
  });
  if (scopeReason) return skip(supabase, run, scopeReason, true, snapshot.handled);
  if (!isScheduleActive(config.schedule)) return skip(supabase, run, "Fuera del horario del asistente", true, snapshot.handled);

  const ctx: RunContext = {
    supabase,
    run,
    agentId: agent.id,
    agentConfigRaw: agent.config,
    mode,
    config,
    locked,
    conversation,
    contact,
    snapshot,
  };

  // --- Límite de respuestas seguidas sin intervención humana ---
  if (conversation.agent_consecutive_count >= config.limits.max_consecutive) {
    return handoff(ctx, `Límite de ${config.limits.max_consecutive} respuestas seguidas`, NO_USAGE, "limit_consecutive");
  }

  // --- Topes diario (mensajes) y mensual (tokens) ---
  const periods = periodStarts();
  const { data: today } = await supabase
    .from("agent_usage_log")
    .select("messages_count")
    .eq("agent_id", agent.id)
    .gte("created_at", periods.day)
    .in("outcome", ["sent", "suggested", "handoff"]);
  // Cada mensaje enviado o sugerido cuenta para el tope diario.
  const usedToday = (today ?? []).reduce((sum, r) => sum + (r.messages_count || 1), 0);
  const remainingToday = config.limits.daily_cap - usedToday;
  if (remainingToday <= 0) {
    if (config.alerts.on_daily_cap) {
      await alertOnce(supabase, agent.id, "daily_cap", "admin", periods.day, `${config.display_name} llegó al tope diario de ${config.limits.daily_cap} respuestas.`);
    }
    return block(supabase, run, `Tope diario (${config.limits.daily_cap})`, snapshot.handled);
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
    return block(supabase, run, "Tope mensual de tokens", snapshot.handled);
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

  // --- Temas de escalamiento en CUALQUIER mensaje sin responder (sin gastar tokens) ---
  for (const m of unanswered) {
    const topic = m.body ? matchEscalationTopic(m.body, locked.escalation_topics) : null;
    if (topic) return handoff(ctx, `Tema de escalamiento: ${topic}`, NO_USAGE);
  }

  // --- Respuestas rápidas permitidas, historial y lo que ya respondió ---
  // Regla efectiva: el proveedor no la marcó «solo humano» Y el cliente la encendió.
  const { data: quickReplies } = await supabase
    .from("quick_replies")
    .select("id, shortcut, body, when_to_use, agent_permission")
    .neq("agent_permission", "human_only")
    .order("shortcut");
  const allowedReplies = (quickReplies ?? []).filter((q) => isQuickReplyUsable(q, config));

  const unansweredIds = new Set(unanswered.map((m) => m.id));
  const { data: recent } = await supabase
    .from("messages")
    .select("id, direction, type, body, sent_by_agent")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT + unanswered.length);
  const ordered = (recent ?? []).reverse();
  // El historial NO incluye los sin responder: van en su propio bloque marcado al final.
  const history = buildHistory(
    ordered
      .filter((m) => !unansweredIds.has(m.id))
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ direction: m.direction === "inbound" ? "inbound" : "outbound", type: m.type, body: m.body })),
  );
  const unansweredPrompt: PromptMessage[] = unanswered.map((m) => ({ direction: "inbound", type: m.type, body: m.body }));

  const { data: previous } = await supabase
    .from("messages")
    .select("body")
    .eq("conversation_id", conversation.id)
    .eq("sent_by_agent", true)
    .order("created_at", { ascending: false })
    .limit(PREVIOUS_REPLIES_LIMIT);
  const previousReplies = (previous ?? [])
    .map((m) => m.body?.trim() ?? "")
    .filter(Boolean)
    .reverse();

  const system = buildSystemPrompt({
    lockedSystemPrompt: locked.system_prompt,
    lockedSafetyRules: locked.safety_rules,
    businessInfo: locked.business_info,
    escalationTopics: locked.escalation_topics,
    config,
    quickReplies: allowedReplies,
    contactFirstName: contact.name?.trim().split(/\s+/)[0] || null,
    agentAlreadySpoke: previousReplies.length > 0,
    previousReplies,
    allowed: allowedTypes(locked),
  });

  // --- Modelo: UNA salida estructurada, validada (cobertura) con un reintento ---
  let planned: PlanOutcome;
  try {
    planned = await planReply({
      system,
      turns: [...history, buildUnansweredTurn(unansweredPrompt)],
      locked,
      allowedShortcuts: allowedReplies.map((q) => q.shortcut),
    });
  } catch (error) {
    const usage = error instanceof ModelProviderError ? error.usage : NO_USAGE;
    const reason = error instanceof ModelProviderError ? error.message : "Error del modelo";
    await logUsage(supabase, { run, outcome: "error", reason, usage, model: locked.model, locked, handled: snapshot.handled });
    // Los errores técnicos solo los ve el proveedor.
    await alertOnce(supabase, agent.id, "error", "superadmin", periods.day, "El asistente tuvo errores al generar respuestas hoy. Revisa el registro de actividad.");
    return { acted: true, reason };
  }
  const { validation, usage, model } = planned;
  ctx.debug = { coverage: validation.coverage, retried: planned.retried };

  // Si tras el reintento sigue sin cubrir todo, NO se manda una respuesta a medias.
  if (!validation.ok) {
    return handoff(ctx, `Respuesta incompleta: ${validation.problems.join("; ")}`.slice(0, 280), usage, "handoff", model);
  }
  if (validation.action === "transfer") {
    return handoff(ctx, validation.reason ? `El asistente transfirió: ${validation.reason}` : "El asistente transfirió a una persona", usage, "handoff", model);
  }

  // --- Mensajes del plan, en orden ---
  const parts: ReplyPart[] = [];
  const reasons: string[] = [];
  let needsApproval = false;
  for (const m of validation.messages) {
    if (m.kind === "quick_reply") {
      const reply = allowedReplies.find((q) => q.shortcut === m.shortcut);
      if (!reply) continue; // ya validado; defensa extra
      // «Con aprobación»: siempre queda como sugerencia, aun en automático.
      if (reply.agent_permission === "approval") needsApproval = true;
      parts.push({ text: applyTemplate(reply.body, contact), quickReplyId: reply.id });
      reasons.push(`/${reply.shortcut}`);
    } else {
      parts.push({ text: m.text.slice(0, MAX_REPLY_CHARS), quickReplyId: null });
      reasons.push("texto");
    }
  }
  // El tope diario cuenta cada mensaje: se recortan los que no caben.
  const allowedParts = parts.slice(0, Math.max(1, remainingToday));
  if (allowedParts.length < parts.length) reasons.push(`recortado por el tope diario (${allowedParts.length}/${parts.length})`);

  return deliver(ctx, {
    parts: allowedParts,
    forceSuggestion: needsApproval,
    usage,
    model,
    reason: `${allowedParts.length > 1 ? `${allowedParts.length} mensajes: ` : ""}${reasons.join(" + ")}${planned.retried ? " (tras reintento)" : ""}`,
  });
}

// ---------------------------------------------------------------------------
// Planificación con el modelo (la usan el motor y el probador)
// ---------------------------------------------------------------------------

/** Tipos de mensaje que permite la capa del proveedor (`allowed_tools`). */
export function allowedTypes(locked: Pick<Locked, "allowed_tools">): { text: boolean; quickReply: boolean; transfer: boolean } {
  return {
    text: locked.allowed_tools.includes(TOOL_TEXT),
    quickReply: locked.allowed_tools.includes(TOOL_QUICK_REPLY),
    transfer: locked.allowed_tools.includes(TOOL_TRANSFER),
  };
}

export type PlanOutcome = { validation: PlanValidation; usage: Usage; model: string; retried: boolean };

/**
 * Pide al modelo un plan con la función «responder» y valida que cubra TODAS
 * las preguntas detectadas con mensajes permitidos. Si no, reintenta UNA vez
 * con un aviso. Devuelve la última validación (ok o con sus problemas) y los
 * tokens sumados de ambos intentos. Lanza ModelProviderError si falla la API.
 */
export async function planReply(input: {
  system: string;
  turns: ChatTurn[];
  locked: Locked;
  allowedShortcuts: string[];
}): Promise<PlanOutcome> {
  const { locked } = input;
  const limits = {
    model: locked.model,
    maxOutputTokens: locked.max_output_tokens,
    reasoningEffort: (["minimal", "low", "medium", "high"] as const).find((e) => e === locked.reasoning_effort) ?? "low",
    temperature: locked.temperature === null ? null : Number(locked.temperature),
  };
  const opts = { allowedTools: locked.allowed_tools, allowedShortcuts: input.allowedShortcuts, maxMessages: MAX_ACTIONS_PER_RUN };
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let model = locked.model;
  let validation: PlanValidation = { ok: false, problems: ["sin respuesta"], coverage: [] };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const turns: ChatTurn[] =
      attempt === 0 || validation.ok ? input.turns : [...input.turns, { role: "user", content: retryNotice(validation.problems) }];
    let result;
    try {
      result = await getModelProvider().generateReply({ system: input.system, messages: turns, tools: AGENT_TOOLS, limits });
    } catch (error) {
      const spent = error instanceof ModelProviderError ? error.usage : NO_USAGE;
      throw new ModelProviderError(error instanceof Error ? error.message : "Error del modelo", {
        inputTokens: usage.inputTokens + spent.inputTokens,
        outputTokens: usage.outputTokens + spent.outputTokens,
      });
    }
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    model = result.model;
    const call = result.toolCalls.find((c) => c.name === RESPONDER_TOOL.name);
    validation = call
      ? validateReplyPlan(parseReplyPlan(call.arguments), opts)
      : { ok: false, problems: ["no llamó a la función «responder»"], coverage: [] };
    if (validation.ok) return { validation, usage, model, retried: attempt === 1 };
  }
  return { validation, usage, model, retried: true };
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

type DeliverResult = RunResult & { stale?: boolean };

/**
 * Entrega la respuesta. Justo antes, vuelve a mirar si llegaron mensajes del
 * cliente desde el snapshot: si llegaron, la respuesta está obsoleta y se
 * DESCARTA (queda una corrida pendiente que los incluya todos).
 * En modo sugerencia (o si se exige aprobación) deja un borrador; en
 * automático envía cada parte con una pausa breve entre ellas.
 */
async function deliver(
  ctx: RunContext,
  input: {
    parts: ReplyPart[];
    forceSuggestion: boolean;
    usage: Usage;
    model?: string;
    reason: string;
    outcome?: "handoff";
  },
): Promise<DeliverResult> {
  const { supabase, run, snapshot } = ctx;
  const base = {
    run,
    usage: input.usage,
    model: input.model,
    locked: ctx.locked,
    handled: snapshot.handled,
    coverage: ctx.debug?.coverage,
    retried: ctx.debug?.retried,
  };

  const newer = await newerInbound(supabase, ctx.conversation.id, snapshot.lastInboundAt);
  if (newer) {
    await logUsage(supabase, { ...base, outcome: "skipped", reason: "Omitido: llegó un mensaje nuevo", discardedStale: true });
    // Asegura una corrida pendiente con todos los mensajes. Si ya existe (la creó el
    // webhook), la base la conserva: nunca la adelanta y no pasa del tope de espera.
    await scheduleRun(supabase, {
      agentId: ctx.agentId,
      conversationId: ctx.conversation.id,
      messageId: newer.id,
      rawConfig: ctx.agentConfigRaw,
      locked: ctx.locked,
    });
    return { acted: false, reason: "Omitido: llegó un mensaje nuevo", stale: true };
  }

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
      trigger_message_id: snapshot.lastInboundId,
      run_id: run.id,
      seen_inbound_at: snapshot.lastInboundAt,
      body: input.parts.map((p) => p.text).join("\n\n"),
      parts: input.parts.map((p) => ({ text: p.text, quick_reply_id: p.quickReplyId })),
      quick_reply_id: input.parts[0]?.quickReplyId ?? null,
    });
    if (error) {
      await logUsage(supabase, { ...base, outcome: "error", reason: "No se pudo guardar la sugerencia" });
      return { acted: true, reason: "No se pudo guardar la sugerencia" };
    }
    await logUsage(supabase, { ...base, outcome: input.outcome ?? "suggested", reason: input.reason, messagesCount: input.parts.length });
    return { acted: true, reason: input.reason };
  }

  let sent = 0;
  let firstMessageId: string | undefined;
  try {
    for (const part of input.parts) {
      if (sent > 0) await sleep(PART_PAUSE_MS);
      const { messageId } = await sendAgentText(supabase, {
        conversationId: ctx.conversation.id,
        waId: ctx.contact.wa_id,
        lastInboundAt: ctx.conversation.last_inbound_at,
        text: part.text,
        agentId: ctx.agentId,
        senderId: null,
        answeredThrough: snapshot.lastInboundAt,
        runId: run.id,
      });
      firstMessageId ??= messageId;
      sent += 1;
    }
    await logUsage(supabase, { ...base, outcome: input.outcome ?? "sent", reason: input.reason, messageId: firstMessageId, messagesCount: sent });
    return { acted: true, reason: input.reason };
  } catch (error) {
    const reason =
      error instanceof AgentSendError
        ? error.message
        : error instanceof WhatsAppApiError
          ? `WhatsApp rechazó el envío (${error.code ?? "?"})`
          : "No se pudo enviar";
    await logUsage(supabase, {
      ...base,
      outcome: sent > 0 ? (input.outcome ?? "sent") : "error",
      reason: sent > 0 ? `${input.reason} (se enviaron ${sent} de ${input.parts.length}: ${reason})` : reason,
      messageId: firstMessageId,
      messagesCount: sent,
    });
    return { acted: true, reason };
  }
}

/**
 * Transfiere a una persona: entrega el mensaje de traspaso del proveedor,
 * pausa el agente en el chat, asigna (si el proveedor lo configuró) y avisa.
 * Si llegaron mensajes nuevos antes de entregarlo, no transfiere todavía: la
 * siguiente corrida decide con todos los mensajes.
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
    parts: [{ text: locked.handoff_message, quickReplyId: null }],
    forceSuggestion: false,
    usage,
    model,
    reason,
    outcome: "handoff",
  });
  if (result.stale) return result;

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
  // El Asistente de notas deja el contexto para la persona que recibe el chat.
  await scheduleNotesForHandoff(supabase, ctx.conversation.id);
  return { ...result, reason };
}

async function skip(supabase: AdminClient, run: Run, reason: string, log = true, handled = 0): Promise<RunResult> {
  if (log) await logUsage(supabase, { run, outcome: "skipped", reason, usage: NO_USAGE, handled });
  return { acted: false, reason };
}

async function block(supabase: AdminClient, run: Run, reason: string, handled = 0): Promise<RunResult> {
  await logUsage(supabase, { run, outcome: "blocked_by_limit", reason, usage: NO_USAGE, handled });
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
    /** Mensajes del cliente que atendió la corrida. */
    handled?: number;
    /** Mensajes que produjo (enviados o sugeridos): cuentan para el tope diario. */
    messagesCount?: number;
    /** Respuesta descartada porque llegaron mensajes nuevos. */
    discardedStale?: boolean;
    /** Preguntas detectadas por el modelo y cómo las cubrió (depuración). */
    coverage?: CoverageEntry[];
    retried?: boolean;
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
    handled_messages: input.handled ?? 0,
    messages_count: input.messagesCount ?? 0,
    discarded_stale: input.discardedStale ?? false,
    coverage: input.coverage ? (input.coverage.slice(0, 10) as unknown as Json) : null,
    retried: input.retried ?? false,
  });
  if (error) console.error(`[agents] No se pudo registrar el uso: ${error.message}`);
}
