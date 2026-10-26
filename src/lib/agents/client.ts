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

export type AgentUsageSummary = {
  today_replies: number;
  today_tokens: number;
  month_replies: number;
  month_tokens: number;
  month_cost_usd: number;
  monthly_token_cap: number;
};

export async function fetchAgent(supabase: Client, key: string): Promise<Agent | null> {
  const { data, error } = await supabase.from("agents").select("*").eq("key", key).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAgentLimits(supabase: Client, key: string): Promise<AgentLimits> {
  const { data, error } = await supabase.rpc("agent_limits", { p_key: key });
  if (error) throw error;
  return { ...DEFAULT_LIMITS, ...((data as Partial<AgentLimits> | null) ?? {}) };
}

export async function fetchUsageSummary(supabase: Client, key: string): Promise<AgentUsageSummary | null> {
  const { data, error } = await supabase.rpc("agent_usage_summary", { p_key: key });
  if (error) throw error;
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return {
    today_replies: n(d.today_replies),
    today_tokens: n(d.today_tokens),
    month_replies: n(d.month_replies),
    month_tokens: n(d.month_tokens),
    month_cost_usd: n(d.month_cost_usd),
    monthly_token_cap: n(d.monthly_token_cap),
  };
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

export async function fetchActivity(supabase: Client, agentId: string, limit = 50): Promise<AgentUsageRow[]> {
  const { data, error } = await supabase
    .from("agent_usage_log")
    .select("*, conversation:conversations(id, contacts(name, wa_id, phone))")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AgentUsageRow[];
}

export async function fetchAlerts(supabase: Client, agentId: string, limit = 20): Promise<AgentAlert[]> {
  const { data, error } = await supabase
    .from("agent_alerts")
    .select("*")
    .eq("agent_id", agentId)
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

/** Envía (tal cual o editada) o descarta una sugerencia. El envío va por el servidor. */
export async function resolveAgentSuggestion(id: string, action: "send" | "discard", text?: string): Promise<void> {
  const response = await fetch(`/api/agents/suggestions/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, text }),
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
