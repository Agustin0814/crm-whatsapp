import "server-only";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { estimateCostUsd, scopeBlockReason } from "./guards";
import { parseNotesConfig, type NotesAgentConfig } from "./notes-config";
import {
  isTrivialText,
  keepHumanSummaryNotice,
  missingSentences,
  NOTES_TOOL,
  NOTES_TOOL_NAME,
  parseCounters,
  parseNotesPlan,
  validateNotesPlan,
  type Counter,
  type ValidatedNotes,
} from "./notes-plan";
import { buildNotesSystemPrompt, buildNotesTurn, type NotesPromptMessage } from "./notes-prompt";
import { getModelProvider, ModelProviderError, type ChatTurn } from "./provider";
import { alertOnce, describe, periodStarts, type AdminClient } from "./shared";

// Motor del Asistente de notas. NUNCA envía mensajes por WhatsApp: solo escribe
// notas internas (tabla notes, con agent_id) y el resumen del contacto
// (contact_summaries). No depende de la pausa del chat ni de que una persona
// lo haya abierto o atendido. Cada pasada queda en agent_usage_log.

type Run = Tables<"agent_scheduled_runs">;
type Locked = Tables<"agent_locked_config">;
type Usage = { inputTokens: number; outputTokens: number };
const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0 };

/** Notas anteriores del agente que ve el modelo (y contra las que se compara). */
const PREVIOUS_NOTES_LIMIT = 15;
/** Notas del agente con las que se buscan repetidas antes de guardar. */
const DEDUPE_NOTES_LIMIT = 40;
/** Pausa entre bloques cuando un chat tiene más mensajes que la ventana. */
const CONTINUE_AFTER_SECONDS = 15;
/** Reintento cuando alguien editó el resumen durante la pasada. */
const CONFLICT_RETRY_SECONDS = 60;

type RunResult = { acted: boolean; reason: string };

type SummaryRow = Tables<"contact_summaries">;

// ---------------------------------------------------------------------------
// Resumen del contacto (reutilizable por otros agentes)
// ---------------------------------------------------------------------------

export type ContactSummary = {
  summary: string;
  counters: Counter[];
  lastProcessedMessageId: string | null;
  lastProcessedAt: string | null;
  updatedByAgentAt: string | null;
  editedByUserAt: string | null;
  /** Mensajes del chat posteriores a la marca de procesado (los que el resumen aún no cubre). */
  newMessages: { id: string; direction: string; type: string; body: string | null; created_at: string; sent_by_agent: boolean }[];
};

/**
 * Resumen del contacto + SOLO los mensajes que todavía no cubre. Preparado para
 * que el Asistente de respuestas lea esto en vez de todo el chat (aún no se usa
 * ahí). Lectura con el cliente admin (servidor).
 */
export async function getContactSummary(
  supabase: AdminClient,
  contactId: string,
  options: { messagesLimit?: number } = {},
): Promise<ContactSummary> {
  const { data: row } = await supabase.from("contact_summaries").select("*").eq("contact_id", contactId).maybeSingle();
  const { data: conversation } = await supabase.from("conversations").select("id").eq("contact_id", contactId).maybeSingle();
  let newMessages: ContactSummary["newMessages"] = [];
  if (conversation) {
    let query = supabase
      .from("messages")
      .select("id, direction, type, body, created_at, sent_by_agent")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(options.messagesLimit ?? 30);
    if (row?.last_processed_at) query = query.gt("created_at", row.last_processed_at);
    const { data } = await query;
    newMessages = (data ?? []).reverse();
  }
  return {
    summary: row?.summary ?? "",
    counters: parseCounters(row?.counters),
    lastProcessedMessageId: row?.last_processed_message_id ?? null,
    lastProcessedAt: row?.last_processed_at ?? null,
    updatedByAgentAt: row?.updated_by_agent_at ?? null,
    editedByUserAt: row?.edited_by_user_at ?? null,
    newMessages,
  };
}

// ---------------------------------------------------------------------------
// Programación
// ---------------------------------------------------------------------------

type NotesAgentRow = {
  id: string;
  config: Json;
  agent_locked_config: Pick<Locked, "kill_switch" | "delay_seconds_min" | "delay_seconds_max" | "max_wait_seconds" | "daily_cap_ceiling"> | null;
};

function notesConfig(agent: NotesAgentRow): NotesAgentConfig | null {
  const locked = agent.agent_locked_config;
  if (!locked || locked.kill_switch) return null;
  return parseNotesConfig(agent.config, {
    daily_cap_max: locked.daily_cap_ceiling,
    delay_seconds_min: locked.delay_seconds_min,
    delay_seconds_max: locked.delay_seconds_max,
  });
}

async function enabledNotesAgents(supabase: AdminClient): Promise<NotesAgentRow[]> {
  const { data } = await supabase
    .from("agents")
    .select("id, config, agent_locked_config(kill_switch, delay_seconds_min, delay_seconds_max, max_wait_seconds, daily_cap_ceiling)")
    .eq("enabled", true)
    .eq("kind", "notes");
  return data ?? [];
}

/**
 * Disparador (a): el chat queda en silencio. Cada mensaje del cliente reinicia
 * la espera (minutos del cliente), sin pasar del tope del proveedor desde que
 * se creó la corrida pendiente. Nunca lanza.
 */
export async function scheduleNotesForInbound(
  supabase: AdminClient,
  agent: NotesAgentRow,
  input: { conversationId: string; messageId: string },
): Promise<void> {
  const config = notesConfig(agent);
  if (!config || !agent.agent_locked_config) return;
  const { error } = await supabase.rpc("schedule_notes_run", {
    p_agent_id: agent.id,
    p_conversation_id: input.conversationId,
    p_message_id: input.messageId,
    p_delay_seconds: config.delay_seconds,
    p_max_wait_seconds: agent.agent_locked_config.max_wait_seconds,
    p_trigger: "inbound",
  });
  if (error) console.error(`[notas] No se pudo programar la pasada: ${error.message}`);
}

/**
 * Disparador (b): el Asistente de respuestas pasó el chat a una persona. Si el
 * cliente dejó «También al pasar el chat a una persona», la pasada sale ya.
 * Nunca lanza.
 */
export async function scheduleNotesForHandoff(supabase: AdminClient, conversationId: string): Promise<void> {
  try {
    for (const agent of await enabledNotesAgents(supabase)) {
      const config = notesConfig(agent);
      if (!config?.on_handoff || !agent.agent_locked_config) continue;
      const { error } = await supabase.rpc("schedule_notes_run", {
        p_agent_id: agent.id,
        p_conversation_id: conversationId,
        p_message_id: null as unknown as string,
        p_delay_seconds: 0,
        p_max_wait_seconds: agent.agent_locked_config.max_wait_seconds,
        p_trigger: "handoff",
      });
      if (error) console.error(`[notas] No se pudo programar la pasada del traspaso: ${error.message}`);
    }
  } catch (error) {
    console.error(`[notas] Error al programar por traspaso: ${describe(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Una pasada
// ---------------------------------------------------------------------------

export async function executeNotesRun(supabase: AdminClient, run: Run): Promise<RunResult> {
  const { data: agent } = await supabase
    .from("agents")
    .select("id, kind, enabled, config, agent_locked_config(*)")
    .eq("id", run.agent_id)
    .maybeSingle();
  const locked = agent?.agent_locked_config ?? null;
  if (!agent || !locked || agent.kind !== "notes") return { acted: false, reason: "Agente no encontrado" };
  if (!agent.enabled) return { acted: false, reason: "Agente apagado" };
  if (locked.kill_switch) {
    if (run.trigger_kind === "backfill") await stopBackfill(supabase, agent.id, "Detenido por el proveedor (kill switch)");
    return log(supabase, run, locked, { outcome: "blocked_by_limit", reason: "Detenido por el proveedor (kill switch)" });
  }
  const config = parseNotesConfig(agent.config, {
    daily_cap_max: locked.daily_cap_ceiling,
    delay_seconds_min: locked.delay_seconds_min,
    delay_seconds_max: locked.delay_seconds_max,
  });

  // --- Conversación, contacto y alcance ---
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, contact_id, contacts(id, classification, contact_tags(tag_id))")
    .eq("id", run.conversation_id)
    .maybeSingle();
  const contact = conversation?.contacts;
  if (!conversation || !contact) return { acted: false, reason: "Conversación no encontrada" };
  const scopeReason = scopeBlockReason(config.scope, {
    classification: contact.classification,
    tagIds: contact.contact_tags.map((t) => t.tag_id),
  });
  if (scopeReason) return log(supabase, run, locked, { outcome: "skipped", reason: scopeReason });

  // --- Resumen actual y mensajes posteriores a la marca ---
  const { data: summaryRow } = await supabase.from("contact_summaries").select("*").eq("contact_id", contact.id).maybeSingle();
  const window = locked.history_window_messages;
  let messagesQuery = supabase
    .from("messages")
    .select("id, direction, type, body, created_at, sent_by_agent")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(window + 1);
  if (summaryRow?.last_processed_at) messagesQuery = messagesQuery.gt("created_at", summaryRow.last_processed_at);
  const { data: fetched } = await messagesQuery;
  const hasMore = (fetched?.length ?? 0) > window;
  const batch = (fetched ?? []).slice(0, window);
  const last = batch.at(-1);
  if (!last) return { acted: false, reason: "Sin mensajes nuevos" };
  const inbound = batch.filter((m) => m.direction === "inbound");

  const ctx: PassContext = { supabase, run, locked, agentId: agent.id, config, conversationId: conversation.id, contactId: contact.id, summaryRow, last, handled: inbound.length };

  // Sin mensajes del cliente, o solo saludos y agradecimientos: se avanza la marca
  // sin gastar tokens ni ensuciar el panel.
  if (!inbound.length || inbound.every((m) => m.type === "text" && isTrivialText(m.body))) {
    const saved = await savePass(ctx, { notes: [], summary: summaryRow?.summary ?? "", summaryChanged: false, counters: parseCounters(summaryRow?.counters) });
    if (saved === "conflict") return conflict(ctx);
    if (hasMore) await continueLater(ctx);
    return log(supabase, run, locked, {
      outcome: "skipped",
      reason: inbound.length ? "Sin información relevante" : "Sin mensajes nuevos del cliente",
      handled: inbound.length,
    });
  }

  // --- Topes: pasadas por día y tokens del mes ---
  const periods = periodStarts();
  const { count: passesToday } = await supabase
    .from("agent_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .eq("outcome", "noted")
    .gte("created_at", periods.day);
  if ((passesToday ?? 0) >= config.limits.daily_cap) {
    if (config.alerts.on_daily_cap) {
      await alertOnce(supabase, agent.id, "daily_cap", "admin", periods.day, `${config.display_name} llegó al límite de ${config.limits.daily_cap} pasadas de hoy.`);
    }
    if (run.trigger_kind === "backfill") await stopBackfill(supabase, agent.id, "Se alcanzó el límite del día");
    return log(supabase, run, locked, { outcome: "blocked_by_limit", reason: `Límite diario (${config.limits.daily_cap} pasadas)`, handled: inbound.length });
  }
  const { data: month } = await supabase
    .from("agent_usage_monthly")
    .select("input_tokens, output_tokens")
    .eq("agent_id", agent.id)
    .eq("month", periods.monthDate)
    .maybeSingle();
  const monthTokens = (month?.input_tokens ?? 0) + (month?.output_tokens ?? 0);
  if (monthTokens >= locked.monthly_token_cap) {
    await alertOnce(supabase, agent.id, "token_cap", "superadmin", periods.month, `${config.display_name}: se alcanzó el tope mensual de ${locked.monthly_token_cap.toLocaleString("es-MX")} tokens. Se detuvo hasta el próximo mes.`);
    if (run.trigger_kind === "backfill") await stopBackfill(supabase, agent.id, "Se alcanzó el tope mensual de tokens");
    return log(supabase, run, locked, { outcome: "blocked_by_limit", reason: "Tope mensual de tokens", handled: inbound.length });
  }
  if (config.alerts.on_monthly_threshold && locked.monthly_token_cap > 0 && monthTokens >= (locked.monthly_token_cap * locked.monthly_alert_threshold_pct) / 100) {
    await alertOnce(supabase, agent.id, "monthly_threshold", "admin", periods.month, `${config.display_name} ya usó el ${locked.monthly_alert_threshold_pct} % de su límite del mes.`);
  }

  // --- Notas anteriores del agente en este chat ---
  const { data: previous } = await supabase
    .from("notes")
    .select("body")
    .eq("conversation_id", conversation.id)
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(DEDUPE_NOTES_LIMIT);
  const previousNotes = (previous ?? []).map((n) => n.body);
  const previousCounters = parseCounters(summaryRow?.counters);
  const summaryEditedByPerson = Boolean(
    summaryRow?.edited_by_user_at && (!summaryRow.updated_by_agent_at || summaryRow.edited_by_user_at > summaryRow.updated_by_agent_at),
  );

  // --- Modelo ---
  const system = buildNotesSystemPrompt({
    lockedSystemPrompt: locked.system_prompt,
    lockedSafetyRules: locked.safety_rules,
    config,
    summaryMaxChars: locked.summary_max_chars,
  });
  const turn = buildNotesTurn({
    summary: summaryRow?.summary ?? "",
    summaryEditedByPerson,
    counters: previousCounters,
    previousNotes: previousNotes.slice(0, PREVIOUS_NOTES_LIMIT).reverse(),
    messages: batch.map<NotesPromptMessage>((m) => ({
      direction: m.direction === "inbound" ? "inbound" : "outbound",
      sentByAgent: m.sent_by_agent,
      type: m.type,
      body: m.body,
      createdAt: m.created_at,
    })),
  });

  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let model = locked.model;
  let retried = false;
  const validateInput = {
    capture: config.capture,
    previousNotes,
    previousSummary: summaryRow?.summary ?? "",
    previousCounters,
    summaryMaxChars: locked.summary_max_chars,
  };
  /** Una llamada a «registrar_notas»; suma los tokens aunque falle. */
  const callModel = async (turns: ChatTurn[]): Promise<Record<string, unknown> | null> => {
    try {
      const result = await getModelProvider().generateReply({
        system,
        messages: turns,
        tools: [NOTES_TOOL],
        limits: {
          model: locked.model,
          maxOutputTokens: locked.max_output_tokens,
          reasoningEffort: (["minimal", "low", "medium", "high"] as const).find((e) => e === locked.reasoning_effort) ?? "low",
          temperature: locked.temperature === null ? null : Number(locked.temperature),
        },
      });
      usage.inputTokens += result.usage.inputTokens;
      usage.outputTokens += result.usage.outputTokens;
      model = result.model;
      return result.toolCalls.find((c) => c.name === NOTES_TOOL_NAME)?.arguments ?? null;
    } catch (error) {
      if (error instanceof ModelProviderError) {
        usage.inputTokens += error.usage.inputTokens;
        usage.outputTokens += error.usage.outputTokens;
      }
      throw error;
    }
  };

  let validated: ValidatedNotes;
  try {
    const turns: ChatTurn[] = [{ role: "user", content: turn }];
    const args = await callModel(turns);
    if (!args) {
      return log(supabase, run, locked, { outcome: "error", reason: "El modelo no llamó a «registrar_notas»", usage, model, handled: inbound.length });
    }
    validated = validateNotesPlan(parseNotesPlan(args), validateInput);
    // Si una persona editó el resumen y el modelo quitó frases suyas, se le avisa UNA vez:
    // debe conservarlas salvo que el cliente las haya corregido en los mensajes nuevos.
    const missing = summaryEditedByPerson && validated.summaryChanged ? missingSentences(summaryRow?.summary ?? "", validated.summary) : [];
    if (missing.length) {
      retried = true;
      const again = await callModel([...turns, { role: "user", content: keepHumanSummaryNotice(missing) }]);
      if (again) validated = validateNotesPlan(parseNotesPlan(again), validateInput);
    }
  } catch (error) {
    const reason = error instanceof ModelProviderError ? error.message : "Error del modelo";
    await alertOnce(supabase, agent.id, "error", "superadmin", periods.day, `${config.display_name} tuvo errores al generar notas hoy. Revisa el registro de actividad.`);
    return log(supabase, run, locked, { outcome: "error", reason, usage, model, handled: inbound.length });
  }

  // --- Guardado atómico ---
  const saved = await savePass(ctx, validated);
  if (saved === "conflict") {
    await log(supabase, run, locked, { outcome: "skipped", reason: "Omitido: el resumen cambió durante la pasada", usage, model, handled: inbound.length });
    return conflict(ctx, false);
  }
  if (hasMore) await continueLater(ctx);

  const parts = [
    saved.notesCreated ? `${saved.notesCreated} nota${saved.notesCreated === 1 ? "" : "s"}` : "sin notas nuevas",
    validated.summaryChanged ? "resumen actualizado" : "resumen sin cambios",
  ];
  if (validated.dropped.length) parts.push(`descartadas: ${validated.dropped.join(", ")}`);
  if (retried) parts.push("reintento para conservar el resumen de una persona");
  if (hasMore) parts.push("continúa con más mensajes");
  return log(supabase, run, locked, {
    outcome: "noted",
    reason: parts.join(" · "),
    usage,
    model,
    handled: inbound.length,
    notesCreated: saved.notesCreated,
    summaryUpdated: validated.summaryChanged,
    acted: true,
  });
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

type PassContext = {
  supabase: AdminClient;
  run: Run;
  locked: Locked;
  agentId: string;
  config: NotesAgentConfig;
  conversationId: string;
  contactId: string;
  summaryRow: SummaryRow | null;
  last: { id: string; created_at: string };
  handled: number;
};

/** Guarda notas, resumen y marca en UNA transacción (save_notes_pass). */
async function savePass(
  ctx: PassContext,
  result: { notes: { text: string; dedupeKey: string }[]; summary: string; summaryChanged: boolean; counters: Counter[] },
): Promise<{ notesCreated: number } | "conflict"> {
  const { data, error } = await ctx.supabase.rpc("save_notes_pass", {
    p_agent_id: ctx.agentId,
    p_run_id: ctx.run.id,
    p_conversation_id: ctx.conversationId,
    p_contact_id: ctx.contactId,
    p_expected_updated_at: (ctx.summaryRow?.updated_at ?? null) as string,
    p_summary: result.summary,
    p_summary_changed: result.summaryChanged,
    p_counters: result.counters as unknown as Json,
    p_last_message_id: ctx.last.id,
    p_last_message_at: ctx.last.created_at,
    p_notes: result.notes.map((n) => ({ body: n.text, dedupe_key: n.dedupeKey })) as unknown as Json,
    p_agent_label: ctx.config.display_name,
  });
  if (error) throw new Error(`No se pudo guardar la pasada: ${error.message}`);
  const status = (data as { status?: string; notes_created?: number } | null) ?? {};
  if (status.status !== "saved") return "conflict";
  return { notesCreated: status.notes_created ?? 0 };
}

/**
 * Disparador de una corrida de seguimiento: la de «Procesar chats existentes»
 * sigue en su cola (se detiene con ella); cualquier otra, como una normal.
 */
function followUpTrigger(run: Run): "backfill" | "inbound" {
  return run.trigger_kind === "backfill" ? "backfill" : "inbound";
}

/** Alguien cambió el resumen (o hubo otra pasada): se reintenta en un minuto. */
async function conflict(ctx: PassContext, logIt = true): Promise<RunResult> {
  await ctx.supabase.rpc("schedule_notes_run", {
    p_agent_id: ctx.agentId,
    p_conversation_id: ctx.conversationId,
    p_message_id: null as unknown as string,
    p_delay_seconds: CONFLICT_RETRY_SECONDS,
    p_max_wait_seconds: ctx.locked.max_wait_seconds,
    p_trigger: followUpTrigger(ctx.run),
    p_run_at: new Date(Date.now() + CONFLICT_RETRY_SECONDS * 1000).toISOString(),
  });
  if (logIt) await log(ctx.supabase, ctx.run, ctx.locked, { outcome: "skipped", reason: "Omitido: el resumen cambió durante la pasada" });
  return { acted: false, reason: "Omitido: el resumen cambió durante la pasada" };
}

/** El chat tiene más mensajes que la ventana: se programa el siguiente bloque. */
async function continueLater(ctx: PassContext): Promise<void> {
  await ctx.supabase.rpc("schedule_notes_run", {
    p_agent_id: ctx.agentId,
    p_conversation_id: ctx.conversationId,
    p_message_id: null as unknown as string,
    p_delay_seconds: CONTINUE_AFTER_SECONDS,
    p_max_wait_seconds: ctx.locked.max_wait_seconds,
    p_trigger: followUpTrigger(ctx.run),
    p_run_at: new Date(Date.now() + CONTINUE_AFTER_SECONDS * 1000).toISOString(),
  });
}

/** Detiene «Procesar chats existentes»: cancela las corridas de la cola. */
async function stopBackfill(supabase: AdminClient, agentId: string, reason: string): Promise<void> {
  await supabase
    .from("agent_scheduled_runs")
    .update({ status: "cancelled", reason, updated_at: new Date().toISOString() })
    .eq("agent_id", agentId)
    .eq("status", "pending")
    .eq("trigger_kind", "backfill");
}

async function log(
  supabase: AdminClient,
  run: Run,
  locked: Locked,
  input: {
    outcome: "noted" | "skipped" | "error" | "blocked_by_limit";
    reason: string;
    usage?: Usage;
    model?: string;
    handled?: number;
    notesCreated?: number;
    summaryUpdated?: boolean;
    acted?: boolean;
  },
): Promise<RunResult> {
  const usage = input.usage ?? NO_USAGE;
  const { error } = await supabase.from("agent_usage_log").insert({
    agent_id: run.agent_id,
    conversation_id: run.conversation_id,
    run_id: run.id,
    model: input.model ?? locked.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    est_cost_usd: estimateCostUsd(usage, {
      input_price_per_mtok: Number(locked.input_price_per_mtok),
      output_price_per_mtok: Number(locked.output_price_per_mtok),
    }),
    outcome: input.outcome,
    reason: input.reason.slice(0, 300),
    handled_messages: input.handled ?? 0,
    notes_created: input.notesCreated ?? 0,
    summary_updated: input.summaryUpdated ?? false,
  });
  if (error) console.error(`[notas] No se pudo registrar el uso: ${error.message}`);
  return { acted: input.acted ?? input.outcome === "error", reason: input.reason };
}
