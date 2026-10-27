// Consultas del Asistente del sistema desde el navegador. Las preguntas van por
// /api/assistant/* (el servidor valida todo); la lista de chats, renombrar y
// borrar van directo por RLS (min_role, creador o admin).

import type { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { rowsToTurns, type StoredTurn } from "./system-plan";

type Client = ReturnType<typeof createClient>;

export type AssistantChat = Tables<"assistant_chats">;
export type AgentRequest = Tables<"agent_requests">;

/** Un turno en pantalla. `token` solo existe en el chat temporal (firma del servidor). */
export type ClientTurn = StoredTurn & { token: string | null };

export type AskResponse = {
  turn: StoredTurn;
  token: string | null;
  chatId: string | null;
  requests: AgentRequest[];
  questions: { used: number; limit: number };
};

export type AskChat = { mode: "temp"; history: string[] } | { mode: "saved"; id: string } | { mode: "new"; title?: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Ocurrió un error");
  return data;
}

export function askAssistant(input: { question: string; chat: AskChat; screenConversationId: string | null }): Promise<AskResponse> {
  return postJson<AskResponse>("/api/assistant/ask", input);
}

export async function saveTempChat(title: string, turns: string[]): Promise<string> {
  const { chatId } = await postJson<{ chatId: string }>("/api/assistant/chats", { title, turns });
  return chatId;
}

export async function resolveAgentRequest(id: string, action: "confirm" | "cancel"): Promise<AgentRequest> {
  const { request } = await postJson<{ request: AgentRequest }>(`/api/assistant/requests/${id}`, { action });
  return request;
}

export async function fetchAgentRequests(supabase: Client, ids: string[]): Promise<AgentRequest[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("agent_requests").select("*").in("id", ids);
  if (error) throw error;
  return data;
}

export async function fetchAssistantChats(supabase: Client): Promise<AssistantChat[]> {
  const { data, error } = await supabase.from("assistant_chats").select("*").order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data;
}

export async function fetchAssistantTurns(supabase: Client, chatId: string): Promise<StoredTurn[]> {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("role, content, tool_name, tool_data, fetched_at, chart, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return rowsToTurns(data);
}

export async function renameAssistantChat(supabase: Client, id: string, title: string): Promise<void> {
  const { error } = await supabase.from("assistant_chats").update({ title: title.trim().slice(0, 80) }).eq("id", id);
  if (error) throw error;
}

export async function deleteAssistantChat(supabase: Client, id: string): Promise<void> {
  const { error, count } = await supabase.from("assistant_chats").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw new Error("No puedes borrar este chat");
}

/** Etiquetas de la tarjeta de una solicitud. */
export const REQUEST_ACTION_LABELS: Record<string, { agent: string; action: string }> = {
  "notes.run_now": { agent: "Asistente de notas", action: "Anotar este chat ahora" },
  "responder.pause": { agent: "Asistente de respuestas", action: "Pausar en este chat" },
  "responder.resume": { agent: "Asistente de respuestas", action: "Reanudar en este chat" },
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending_confirmation: "Esperando tu confirmación",
  queued: "En cola",
  running: "En proceso…",
  done: "Hecho",
  failed: "No se pudo",
  cancelled: "Cancelada",
  expired: "Caducó",
};
