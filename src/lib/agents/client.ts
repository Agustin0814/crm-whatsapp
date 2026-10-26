// Consultas de agentes desde el navegador (sesión del usuario, RLS). Los
// límites se vuelven a aplicar en la base y en el motor: aquí solo se lee y
// se piden cambios.

import type { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { DEFAULT_LIMITS, type AgentConfig, type AgentLimits, type AgentMode } from "./config";

type Client = ReturnType<typeof createClient>;

export type Agent = Tables<"agents">;
export type AgentLockedConfig = Tables<"agent_locked_config">;
export type AgentSuggestion = Tables<"agent_suggestions">;
export type AgentAlert = Tables<"agent_alerts">;
export type AgentUsageRow = Tables<"agent_usage_log"> & {
  conversation: { id: string; contacts: { name: string | null; wa_id: string | null; phone: string | null } | null } | null;
};

/** Uso del mes actual sumado entre TODOS los agentes. */
export type MonthlyUsage = {
  replies: number;
  tokens: number;
  costUsd: number;
};

export async function fetchAgent(supabase: Client, key: string): Promise<Agent | null> {
  const { data, error } = await supabase.from("agents").select("*").eq("key", key).maybeSingle();
  if (error) throw error;
  return data;
}

/** Todos los agentes (la lista de /agentes no asume uno solo). */
export async function fetchAgents(supabase: Client): Promise<Agent[]> {
  const { data, error } = await supabase.from("agents").select("*").order("name");
  if (error) throw error;
  return data;
}

/** Primer día del mes actual en America/Hermosillo (UTC−7 fijo), «AAAA-MM-01». */
function currentMonthDate(now: Date = new Date()): string {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Hermosillo" }).format(now);
  return `${local.slice(0, 7)}-01`;
}

/**
 * Uso del mes de todos los agentes, agregando la vista agent_usage_monthly
 * (una fila por agente y mes). La RLS solo devuelve datos a admin.
 */
export async function fetchMonthlyUsage(supabase: Client): Promise<MonthlyUsage> {
  const { data, error } = await supabase
    .from("agent_usage_monthly")
    .select("replies, input_tokens, output_tokens, est_cost_usd")
    .eq("month", currentMonthDate());
  if (error) throw error;
  return (data ?? []).reduce<MonthlyUsage>(
    (acc, row) => ({
      replies: acc.replies + (Number(row.replies) || 0),
      tokens: acc.tokens + (Number(row.input_tokens) || 0) + (Number(row.output_tokens) || 0),
      costUsd: acc.costUsd + (Number(row.est_cost_usd) || 0),
    }),
    { replies: 0, tokens: 0, costUsd: 0 },
  );
}

export async function fetchAgentLimits(supabase: Client, key: string): Promise<AgentLimits> {
  const { data, error } = await supabase.rpc("agent_limits", { p_key: key });
  if (error) throw error;
  return { ...DEFAULT_LIMITS, ...((data as Partial<AgentLimits> | null) ?? {}) };
}

/** Guarda la capa editable (la base recorta los valores a los límites). */
export async function saveAgentSettings(
  supabase: Client,
  key: string,
  changes: { enabled?: boolean; mode?: AgentMode; config?: AgentConfig },
): Promise<Agent> {
  // null = «no cambiar» (la función usa coalesce); los tipos generados no lo reflejan.
  const { data, error } = await supabase.rpc("update_agent_settings", {
    p_key: key,
    p_enabled: (changes.enabled ?? null) as boolean,
    p_mode: (changes.mode ?? null) as string,
    p_config: (changes.config ?? null) as unknown as Json,
  });
  if (error) throw error;
  return data as Agent;
}

/** Últimas acciones de los agentes indicados (todos los de la página). */
export async function fetchActivity(supabase: Client, agentIds: string[], limit = 50): Promise<AgentUsageRow[]> {
  if (!agentIds.length) return [];
  const { data, error } = await supabase
    .from("agent_usage_log")
    .select("*, conversation:conversations(id, contacts(name, wa_id, phone))")
    .in("agent_id", agentIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AgentUsageRow[];
}

/** Alertas de todos los agentes (la RLS filtra por audiencia). */
export async function fetchAlerts(supabase: Client, limit = 20): Promise<AgentAlert[]> {
  const { data, error } = await supabase
    .from("agent_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function markAlertsRead(supabase: Client, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from("agent_alerts").update({ read_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
}

/** Capa bloqueada: la RLS solo la devuelve a un superadmin. */
export async function fetchLockedConfig(supabase: Client, agentId: string): Promise<AgentLockedConfig | null> {
  const { data, error } = await supabase.from("agent_locked_config").select("*").eq("agent_id", agentId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveLockedConfig(
  supabase: Client,
  agentId: string,
  values: Omit<AgentLockedConfig, "agent_id" | "updated_at" | "updated_by">,
): Promise<AgentLockedConfig> {
  const { data, error } = await supabase
    .from("agent_locked_config")
    .update(values)
    .eq("agent_id", agentId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// --- Chat ----------------------------------------------------------------------

export async function fetchPendingAgentSuggestion(supabase: Client, conversationId: string): Promise<AgentSuggestion | null> {
  const { data, error } = await supabase
    .from("agent_suggestions")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Partes (mensajes) de una sugerencia; las antiguas solo tienen `body`. */
export function suggestionParts(suggestion: Pick<AgentSuggestion, "parts" | "body">): string[] {
  const parts = Array.isArray(suggestion.parts)
    ? suggestion.parts
        .map((p) => (p && typeof p === "object" && !Array.isArray(p) && typeof p.text === "string" ? p.text : ""))
        .filter(Boolean)
    : [];
  return parts.length ? parts : [suggestion.body];
}

/**
 * Envía (tal cual o editada, `texts` = una por parte) o descarta una sugerencia.
 * El envío va por el servidor, que manda las partes en orden.
 */
export async function resolveAgentSuggestion(id: string, action: "send" | "discard", texts?: string[]): Promise<void> {
  const response = await fetch(`/api/agents/suggestions/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, texts }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "No se pudo completar la acción");
  }
}

/** Pausa o reanuda el agente en un chat (reanudar reinicia las respuestas seguidas). */
export async function setAgentPaused(supabase: Client, conversationId: string, paused: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_agent_paused", { p_conversation_id: conversationId, p_paused: paused });
  if (error) throw error;
}
