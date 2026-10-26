import type { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

type BrowserClient = ReturnType<typeof createClient>;

/**
 * Compras = UN contador por persona o empresa (CRM, no ERP). Qué compró se
 * escribe como nota interna del chat. Toda la lógica vive en la base
 * (`update_purchase_count`): la interfaz y los futuros agentes la reutilizan.
 */
export type EntityRef = { kind: "contact" | "company"; id: string };

/** Estado que devuelve la base tras cada cambio del contador. */
export type PurchaseState = {
  purchase_count: number;
  last_purchase_at: string | null;
  classification: string;
  classification_source: string;
  classified_at: string | null;
};

/** Respuesta de «+1»: incluye lo necesario para «Deshacer» (la base lo vuelve a validar). */
export type PurchaseResult = PurchaseState & { count_after: number; promoted: boolean; previous: PurchaseState };

type Action = { action: "increment" } | { action: "decrement" } | { action: "set"; value: number } | { action: "undo"; undo: PurchaseResult };

/** Suma, resta, fija o deshace en una sola llamada atómica (bloquea la fila). */
export async function updatePurchaseCount(supabase: BrowserClient, entity: EntityRef, change: Action): Promise<PurchaseResult> {
  const { data, error } = await supabase.rpc("update_purchase_count", {
    p_entity: entity.kind,
    p_id: entity.id,
    p_action: change.action,
    p_value: change.action === "set" ? change.value : undefined,
    p_undo: change.action === "undo" ? (change.undo as unknown as Json) : undefined,
  });
  if (error) throw error;
  return data as unknown as PurchaseResult;
}

export type ContactsSummary = { contacts: number; customers: number; inactive_customers: number; companies: number };

/** Conteos de las tarjetas de /contactos (calculados en la base, sin cargar listas). */
export async function fetchContactsSummary(supabase: BrowserClient): Promise<ContactsSummary> {
  const { data, error } = await supabase.rpc("contacts_summary");
  if (error) throw error;
  const row = data[0];
  return {
    contacts: Number(row?.contacts ?? 0),
    customers: Number(row?.customers ?? 0),
    inactive_customers: Number(row?.inactive_customers ?? 0),
    companies: Number(row?.companies ?? 0),
  };
}

/** Evento global: cambió algo que afecta a los conteos o al directorio. */
export const CONTACTS_CHANGED_EVENT = "crm:contactos-cambiaron";
export function notifyContactsChanged() {
  window.dispatchEvent(new Event(CONTACTS_CHANGED_EVENT));
}
