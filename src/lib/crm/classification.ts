import type { createClient } from "@/lib/supabase/client";
import type {
  Classification,
  ClassificationEntity,
  ClassificationHistoryEntry,
  ClassificationSuggestion,
} from "./types";

type BrowserClient = ReturnType<typeof createClient>;

/**
 * Cambia la clasificación a mano. La base registra el historial (origen
 * «manual», usuario y motivo) dentro de la misma transacción.
 */
export async function setClassification(
  supabase: BrowserClient,
  entity: ClassificationEntity,
  id: string,
  classification: Classification,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("set_classification", {
    p_entity: entity,
    p_id: id,
    p_classification: classification,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

/** Historial de clasificación, del más reciente al más antiguo. */
export async function fetchClassificationHistory(
  supabase: BrowserClient,
  entity: ClassificationEntity,
  id: string,
): Promise<ClassificationHistoryEntry[]> {
  const { data, error } = await supabase
    .from("classification_history")
    .select("*")
    .eq(entity === "contact" ? "contact_id" : "company_id", id)
    .order("changed_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

/** Sugerencia pendiente del contacto (como máximo hay una). */
export async function fetchPendingSuggestion(
  supabase: BrowserClient,
  contactId: string,
): Promise<ClassificationSuggestion | null> {
  const { data, error } = await supabase
    .from("classification_suggestions")
    .select("*")
    .eq("contact_id", contactId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Acepta (marca como prospecto) o descarta una sugerencia. */
export async function resolveSuggestion(supabase: BrowserClient, id: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("resolve_suggestion", { p_id: id, p_accept: accept });
  if (error) throw error;
}
