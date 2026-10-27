import "server-only";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { HELP_ARTICLES } from "@/lib/help/articles.generated";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone } from "@/lib/format";
import { estimateCostUsd } from "./guards";
import { getModelProvider, ModelProviderError } from "./provider";
import { alertOnce, describe, periodStarts, type AdminClient } from "./shared";
import { canUseSystemAssistant, parseSystemConfig, type SystemAgentConfig } from "./system-config";
import {
  buildChart,
  cleanAnswer,
  FINAL_TOOL,
  FINAL_TOOL_NAME,
  isAssistantRole,
  isSystemToolName,
  namedConversations,
  nextResultId,
  parseFinal,
  rowsToTurns,
  toolMinRole,
  trimForModel,
  turnMinRole,
  type AssistantRole,
  type StoredTurn,
  type ToolResult,
} from "./system-plan";
import { buildAssistantHistory, buildSystemAssistantPrompt, type ScreenContext } from "./system-prompt";
import { availableTools, executeTool, ToolDenied, type ToolContext, type UserClient } from "./system-tools";
import { signTurn, verifyTurn } from "./system-turns";

// Motor del Asistente del sistema («Cerebro»). Conversa con el EQUIPO: lee con
// herramientas cerradas (sesión del usuario) y solo PROPONE tareas a otros
// agentes. Cada pregunta queda en agent_usage_log SIN contenido ni user_id.

type Locked = Tables<"agent_locked_config">;
export type AgentRequestRow = Tables<"agent_requests">;

export const QUESTION_MAX_CHARS = 2000;
const TEMP_HISTORY_MAX = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Datos guardados por resultado (el modelo ve menos: tool_result_max_chars). */
const STORED_RESULT_MAX_CHARS = 12_000;

export type AssistantFailure = { ok: false; status: number; error: string };

export type AssistantAccess = {
  ok: true;
  admin: AdminClient;
  userId: string;
  userName: string;
  role: AssistantRole;
  agentId: string;
  config: SystemAgentConfig;
  locked: Locked;
};

/** Sesión, rol, agente encendido, kill switch y rol permitido. */
export async function checkAssistantAccess(supabase: UserClient): Promise<AssistantAccess | AssistantFailure> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "No autenticado" };
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (!profile || !isAssistantRole(profile.role)) return { ok: false, status: 403, error: "Sin permiso" };
  const admin = createAdminClient();
  const { data: agent } = await admin.from("agents").select("id, enabled, config, agent_locked_config(*)").eq("kind", "system").maybeSingle();
  const locked = agent?.agent_locked_config ?? null;
  if (!agent || !locked) return { ok: false, status: 404, error: "El asistente no está disponible" };
  const config = parseSystemConfig(agent.config, locked.per_person_daily_ceiling);
  if (!agent.enabled || locked.kill_switch) return { ok: false, status: 403, error: "El asistente no está activo" };
  if (!canUseSystemAssistant(config, profile.role)) return { ok: false, status: 403, error: "Tu rol no puede usar el asistente" };
  return { ok: true, admin, userId: user.id, userName: profile.full_name?.trim() || "una persona del equipo", role: profile.role, agentId: agent.id, config, locked };
}

export type ChatMode = { mode: "temp"; history: unknown[] } | { mode: "saved"; id: string } | { mode: "new"; title: string | null };

export type AskSuccess = {
  ok: true;
  turn: StoredTurn;
  /** Chat temporal: turno firmado para el historial del navegador. */
  token: string | null;
  chatId: string | null;
  requests: AgentRequestRow[];
  questions: { used: number; limit: number };
};

// ---------------------------------------------------------------------------
// Chats guardados: lectura (sesión del usuario, RLS por min_role)
// ---------------------------------------------------------------------------

async function loadSavedTurns(supabase: UserClient, chatId: string): Promise<StoredTurn[] | null> {
  const { data: chat } = await supabase.from("assistant_chats").select("id").eq("id", chatId).maybeSingle();
  if (!chat) return null;
  const { data: rows } = await supabase
    .from("assistant_messages")
    .select("role, content, tool_name, tool_data, fetched_at, chart, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  return rowsToTurns(rows ?? []);
}

function turnToRows(turn: StoredTurn, userId: string): Record<string, unknown>[] {
  return [
    { role: "user", content: turn.question, author_id: userId },
    ...turn.results.map((r) => ({
      role: "tool",
      content: "",
      tool_name: r.tool,
      tool_data: { id: r.id, min_role: r.minRole, data: r.data, named: r.named },
      fetched_at: r.fetchedAt,
    })),
    {
      role: "assistant",
      content: turn.answer,
      chart: turn.chart,
      tool_data: { articles: turn.articles, request_ids: turn.requestIds },
      request_id: turn.requestIds[0] ?? null,
    },
  ];
}

/** Guarda turnos en un chat (solo el servidor) y sube su min_role si hace falta. */
async function persistTurns(admin: AdminClient, chatId: string, turns: StoredTurn[], userId: string): Promise<void> {
  for (const turn of turns) {
    const { error } = await admin.rpc("save_assistant_turn", {
      p_chat_id: chatId,
      p_min_role: turnMinRole(turn),
      p_messages: turnToRows(turn, userId) as unknown as Json,
    });
    if (error) throw new Error(`No se pudo guardar el chat: ${error.message}`);
  }
}

async function createChat(admin: AdminClient, title: string, userId: string): Promise<string> {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 80) || "Nuevo chat";
  const { data, error } = await admin.from("assistant_chats").insert({ title: clean, created_by: userId }).select("id").single();
  if (error) throw new Error(`No se pudo crear el chat: ${error.message}`);
  return data.id;
}

/** Convierte un chat temporal (turnos firmados) en uno guardado con nombre. */
export async function saveTempChat(
  supabase: UserClient,
  input: { title: string; turns: unknown[] },
): Promise<{ ok: true; chatId: string } | AssistantFailure> {
  const access = await checkAssistantAccess(supabase);
  if (!access.ok) return access;
  if (!access.config.saved_chats) return { ok: false, status: 403, error: "Los chats guardados están desactivados" };
  const title = input.title.trim();
  if (!title) return { ok: false, status: 400, error: "Escribe un nombre para el chat" };
  const turns = input.turns.slice(-50).map((t) => verifyTurn(t, access.userId));
  if (!turns.length || turns.some((t) => !t)) return { ok: false, status: 400, error: "El chat no es válido o caducó" };
  const chatId = await createChat(access.admin, title, access.userId);
  await persistTurns(access.admin, chatId, turns as StoredTurn[], access.userId);
  const requestIds = (turns as StoredTurn[]).flatMap((t) => t.requestIds);
  if (requestIds.length) {
    await access.admin.from("agent_requests").update({ assistant_chat_id: chatId }).in("id", requestIds).eq("requested_by", access.userId);
  }
  return { ok: true, chatId };
}

// ---------------------------------------------------------------------------
// Una pregunta
// ---------------------------------------------------------------------------

async function screenContext(supabase: UserClient, conversationId: unknown): Promise<ScreenContext> {
  if (typeof conversationId !== "string" || !UUID.test(conversationId)) return null;
  const { data } = await supabase.from("conversations").select("id, contacts(name, wa_id, phone)").eq("id", conversationId).maybeSingle();
  if (!data) return null;
  const contactName = data.contacts?.name?.trim() || formatPhone(data.contacts?.wa_id ?? data.contacts?.phone) || "Sin nombre";
  return { conversationId: data.id, contactName };
}

async function logUsage(
  admin: AdminClient,
  access: Pick<AssistantAccess, "agentId" | "locked">,
  input: { outcome: "answered" | "error" | "blocked_by_limit"; reason: string; usage?: { inputTokens: number; outputTokens: number }; model?: string },
): Promise<void> {
  const usage = input.usage ?? { inputTokens: 0, outputTokens: 0 };
  // Sin contenido, sin user_id y sin conversación: solo tokens, costo y motivo.
  const { error } = await admin.from("agent_usage_log").insert({
    agent_id: access.agentId,
    model: input.model ?? access.locked.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    est_cost_usd: estimateCostUsd(usage, {
      input_price_per_mtok: Number(access.locked.input_price_per_mtok),
      output_price_per_mtok: Number(access.locked.output_price_per_mtok),
    }),
    outcome: input.outcome,
    reason: input.reason.slice(0, 300),
    handled_messages: 1,
  });
  if (error) console.error(`[asistente] No se pudo registrar el uso: ${error.message}`);
}

function failure(status: number, error: string): AssistantFailure {
  return { ok: false, status, error };
}

export async function askAssistant(
  supabase: UserClient,
  input: { question: string; chat: ChatMode; screenConversationId: unknown },
): Promise<AskSuccess | AssistantFailure> {
  const question = input.question.trim().slice(0, QUESTION_MAX_CHARS);
  if (!question) return failure(400, "Escribe una pregunta");
  const access = await checkAssistantAccess(supabase);
  if (!access.ok) return access;
  const { admin, config, locked } = access;
  if (input.chat.mode === "temp" && !config.temp_chat) return failure(403, "El chat temporal está desactivado");
  if (input.chat.mode !== "temp" && !config.saved_chats) return failure(403, "Los chats guardados están desactivados");

  // --- Tope mensual de tokens (antes de gastar la pregunta) ---
  const periods = periodStarts();
  const { data: month } = await admin
    .from("agent_usage_monthly")
    .select("input_tokens, output_tokens")
    .eq("agent_id", access.agentId)
    .eq("month", periods.monthDate)
    .maybeSingle();
  const monthTokens = (month?.input_tokens ?? 0) + (month?.output_tokens ?? 0);
  if (monthTokens >= locked.monthly_token_cap) {
    await alertOnce(admin, access.agentId, "token_cap", "superadmin", periods.month, `${config.display_name}: se alcanzó el tope mensual de ${locked.monthly_token_cap.toLocaleString("es-MX")} tokens. Se detuvo hasta el próximo mes.`);
    await logUsage(admin, access, { outcome: "blocked_by_limit", reason: "Tope mensual de tokens" });
    return failure(429, "El asistente llegó a su límite de este mes.");
  }

  // --- Preguntas por persona al día (atómico en la base; también revalida el acceso) ---
  const { data: consumed, error: consumeError } = await supabase.rpc("assistant_consume_question");
  if (consumeError) return failure(403, consumeError.message);
  const quota = (consumed ?? {}) as { allowed?: boolean; used?: number; limit?: number };
  const questions = { used: Number(quota.used) || 0, limit: Number(quota.limit) || config.limits.daily_questions_per_person };
  if (!quota.allowed) {
    if (config.alerts.on_daily_cap) {
      await alertOnce(admin, access.agentId, "daily_cap", "admin", periods.day, `Una persona llegó al límite de ${questions.limit} preguntas de hoy en ${config.display_name}.`);
    }
    await logUsage(admin, access, { outcome: "blocked_by_limit", reason: `Límite de ${questions.limit} preguntas por persona al día` });
    return failure(429, `Llegaste al límite de ${questions.limit} preguntas de hoy. Vuelve a intentarlo mañana.`);
  }
  if (config.alerts.on_monthly_threshold && locked.monthly_token_cap > 0 && monthTokens >= (locked.monthly_token_cap * locked.monthly_alert_threshold_pct) / 100) {
    await alertOnce(admin, access.agentId, "monthly_threshold", "admin", periods.month, `${config.display_name} ya usó el ${locked.monthly_alert_threshold_pct} % de su límite del mes.`);
  }

  return answerQuestion(supabase, access, { question, chat: input.chat, screenConversationId: input.screenConversationId }, questions);
}

/**
 * Responde una pregunta ya autorizada (acceso, tope mensual y cupo diario
 * comprobados por `askAssistant`): historial, bucle de herramientas, respuesta,
 * guardado o firma y registro.
 */
export async function answerQuestion(
  supabase: UserClient,
  access: AssistantAccess,
  input: { question: string; chat: ChatMode; screenConversationId: unknown },
  questions: { used: number; limit: number },
): Promise<AskSuccess | AssistantFailure> {
  const { admin, config, locked } = access;
  const question = input.question;
  const periods = periodStarts();

  // --- Historial ---
  let history: StoredTurn[] = [];
  let chatId: string | null = null;
  if (input.chat.mode === "temp") {
    history = input.chat.history
      .slice(-TEMP_HISTORY_MAX)
      .map((t) => verifyTurn(t, access.userId))
      .filter((t): t is StoredTurn => !!t);
  } else if (input.chat.mode === "saved") {
    if (!UUID.test(input.chat.id)) return failure(400, "Chat no válido");
    const loaded = await loadSavedTurns(supabase, input.chat.id);
    if (!loaded) return failure(404, "Chat no encontrado");
    history = loaded;
    chatId = input.chat.id;
  }

  const screen = await screenContext(supabase, input.screenConversationId);
  const previousResults = history.flatMap((t) => t.results);
  const newResultId = nextResultId(previousResults);
  const results: ToolResult[] = [];
  const ctx: ToolContext = {
    supabase,
    admin,
    userId: access.userId,
    role: access.role,
    question,
    screen,
    namedBefore: namedConversations(history),
    namedNow: new Set(),
    config,
    lockedToolRoles: locked.tool_min_roles,
    chatId,
    requestIds: [],
  };

  const system = buildSystemAssistantPrompt({
    lockedSystemPrompt: locked.system_prompt,
    lockedSafetyRules: locked.safety_rules,
    displayName: config.display_name,
    role: access.role,
    userName: access.userName,
    now: new Date(),
    screen,
  });
  const messages = buildAssistantHistory(history, question, {
    maxMessages: locked.history_window_messages,
    maxTokens: locked.history_max_tokens,
    resultMaxChars: locked.tool_result_max_chars,
  });

  let usage = { inputTokens: 0, outputTokens: 0 };
  let model = locked.model;
  let toolCalls = 0;
  let final: ReturnType<typeof parseFinal> = null;
  try {
    const loop = await getModelProvider().runToolLoop({
      system,
      messages,
      tools: [...availableTools(locked.allowed_tools, config), FINAL_TOOL],
      limits: {
        model: locked.model,
        maxOutputTokens: locked.max_output_tokens,
        reasoningEffort: (["minimal", "low", "medium", "high"] as const).find((e) => e === locked.reasoning_effort) ?? "low",
        temperature: locked.temperature === null ? null : Number(locked.temperature),
      },
      finalTool: FINAL_TOOL_NAME,
      maxToolCalls: locked.max_tool_calls,
      execute: async (call) => {
        if (!isSystemToolName(call.name) || !locked.allowed_tools.includes(call.name)) return JSON.stringify({ error: "Herramienta no disponible." });
        try {
          const output = await executeTool(call.name, call.arguments, ctx);
          for (const id of output.named ?? []) ctx.namedNow.add(id);
          const id = newResultId(results.length + 1);
          const fetchedAt = new Date().toISOString();
          const stored = JSON.stringify(output.data).length <= STORED_RESULT_MAX_CHARS ? output.data : { recortado: trimForModel(output.data, STORED_RESULT_MAX_CHARS) };
          results.push({ id, tool: call.name, fetchedAt, minRole: toolMinRole(call.name, locked.tool_min_roles), data: stored, named: output.named ?? [] });
          return trimForModel({ resultado_id: id, obtenido: fetchedAt, ...(output.data as object) }, locked.tool_result_max_chars);
        } catch (error) {
          if (error instanceof ToolDenied) return JSON.stringify({ error: "permiso_denegado", mensaje: "El rol de esta persona no puede ver esta información." });
          console.error(`[asistente] Error en la herramienta ${call.name}: ${describe(error)}`);
          return JSON.stringify({ error: "No se pudo consultar en este momento." });
        }
      },
    });
    usage = loop.usage;
    model = loop.model;
    toolCalls = loop.toolCalls;
    final = parseFinal(loop.final);
  } catch (error) {
    if (error instanceof ModelProviderError) usage = error.usage;
    const reason = error instanceof ModelProviderError ? error.message : "Error del modelo";
    await alertOnce(admin, access.agentId, "error", "superadmin", periods.day, `${config.display_name} tuvo errores al responder hoy. Revisa el registro de actividad.`);
    await logUsage(admin, access, { outcome: "error", reason, usage, model });
    return failure(502, "No pude responder en este momento. Intenta de nuevo.");
  }

  const kind = input.chat.mode === "temp" ? "Chat temporal" : "Chat guardado";
  if (!final) {
    await logUsage(admin, access, { outcome: "error", reason: `${kind} · el modelo no respondió`, usage, model });
    return failure(502, "No pude completar la respuesta. Intenta de nuevo.");
  }

  const validSlugs = new Set(HELP_ARTICLES.map((a) => a.slug));
  const usedHelp = results.some((r) => r.tool === "buscar_ayuda");
  const chart = buildChart(final.chart, [...previousResults, ...results]);
  let answer = cleanAnswer(final.text, [...validSlugs]) || final.text;
  // Se pidió una gráfica que no cuadra con los datos: se dice en vez de prometerla.
  if (final.chart && !chart) answer += "\n\n_No pude armar la gráfica con esos datos._";
  const turn: StoredTurn = {
    question,
    answer,
    at: new Date().toISOString(),
    results,
    chart,
    articles: usedHelp ? final.articles.filter((a) => validSlugs.has(a)) : [],
    requestIds: ctx.requestIds,
  };

  // --- Guardado (chats guardados) o firma (temporal) ---
  let token: string | null = null;
  try {
    if (input.chat.mode === "temp") {
      token = signTurn(turn, access.userId);
    } else {
      if (input.chat.mode === "new") chatId = await createChat(admin, input.chat.title ?? question, access.userId);
      await persistTurns(admin, chatId as string, [turn], access.userId);
      if (ctx.requestIds.length && input.chat.mode === "new") {
        await admin.from("agent_requests").update({ assistant_chat_id: chatId }).in("id", ctx.requestIds);
      }
    }
  } catch (error) {
    console.error(`[asistente] ${describe(error)}`);
    await logUsage(admin, access, { outcome: "error", reason: `${kind} · no se pudo guardar`, usage, model });
    return failure(500, "No se pudo guardar el chat.");
  }

  await logUsage(admin, access, {
    outcome: "answered",
    reason: `${kind} · ${toolCalls} consulta${toolCalls === 1 ? "" : "s"}${ctx.requestIds.length ? " · tarea propuesta" : ""}`,
    usage,
    model,
  });

  const { data: requests } = ctx.requestIds.length
    ? await admin.from("agent_requests").select("*").in("id", ctx.requestIds)
    : { data: [] as AgentRequestRow[] };
  return { ok: true, turn, token, chatId, requests: requests ?? [], questions };
}
