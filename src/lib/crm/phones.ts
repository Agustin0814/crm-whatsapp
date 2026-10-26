import type { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

type BrowserClient = ReturnType<typeof createClient>;

/** Registro que ya usa un teléfono (resultado de `find_phone_matches`). */
export type PhoneMatch = {
  kind: "person" | "company";
  id: string;
  name: string;
  classification: string;
  has_conversation: boolean;
  /** El registro que se edita ya está vinculado (activo) con esta coincidencia. */
  is_linked: boolean;
};

/** Registro que se crea o se edita (para excluirlo de sus propias coincidencias). */
export type PhoneOwner = { kind: "person" | "company"; id?: string };

/**
 * Respuesta de los guardados verificados en la base. El servidor vuelve a
 * buscar coincidencias: si hay alguna que el usuario no vio, no guarda.
 */
export type PhoneSaveResult =
  | { status: "created"; id: string }
  | { status: "updated" }
  | { status: "blocked"; match: PhoneMatch }
  | { status: "needs_confirmation"; matches: PhoneMatch[] }
  | { status: "name_taken" };

/** Por debajo de 10 dígitos no se busca (lo mismo hace la base). */
export function isSearchablePhone(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 10;
}

export async function findPhoneMatches(
  supabase: BrowserClient,
  phone: string,
  owner?: PhoneOwner,
): Promise<PhoneMatch[]> {
  if (!isSearchablePhone(phone)) return [];
  const { data, error } = await supabase.rpc("find_phone_matches", {
    p_phone: phone,
    // Los opcionales aceptan null aunque el tipo generado diga string.
    p_exclude_kind: (owner?.id ? owner.kind : null) as unknown as string,
    p_exclude_id: (owner?.id ?? null) as unknown as string,
  });
  if (error) throw error;
  return data as PhoneMatch[];
}

/** Opción elegida ante una coincidencia: vincular con ella o guardar de todos modos. */
export type PhoneDecision = { mode: "link"; targetId: string; roleIds: string[] } | { mode: "anyway" };

/** Ids que el usuario vio y confirmó (los manda el cliente; el servidor los vuelve a comprobar). */
function acknowledged(matches: PhoneMatch[], decision: PhoneDecision | null): string[] {
  return decision ? matches.map((m) => m.id) : [];
}

function asResult(data: Json): PhoneSaveResult {
  return data as unknown as PhoneSaveResult;
}

export async function createPerson(
  supabase: BrowserClient,
  values: { name: string; phone: string; email: string },
  matches: PhoneMatch[],
  decision: PhoneDecision | null,
): Promise<PhoneSaveResult> {
  const link = decision?.mode === "link" ? decision : null;
  const { data, error } = await supabase.rpc("create_person", {
    p_name: values.name,
    p_phone: values.phone,
    p_email: values.email,
    p_acknowledged: acknowledged(matches, decision),
    p_link_company_id: (link?.targetId ?? null) as unknown as string,
    p_role_ids: link?.roleIds ?? [],
  });
  if (error) throw error;
  return asResult(data);
}

/** Con «vincular», la empresa y el vínculo se crean en la misma transacción. */
export async function createCompanyChecked(
  supabase: BrowserClient,
  values: { name: string; phone: string; email: string },
  matches: PhoneMatch[],
  decision: PhoneDecision | null,
): Promise<PhoneSaveResult> {
  const link = decision?.mode === "link" ? decision : null;
  const { data, error } = await supabase.rpc("create_company", {
    p_trade_name: values.name,
    p_phone: values.phone,
    p_email: values.email,
    p_acknowledged: acknowledged(matches, decision),
    p_link_contact_id: (link?.targetId ?? null) as unknown as string,
    p_role_ids: link?.roleIds ?? [],
  });
  if (error) throw error;
  return asResult(data);
}

/** Cambia el teléfono de un registro existente con la misma verificación (se excluye a sí mismo). */
export async function updatePhone(
  supabase: BrowserClient,
  owner: Required<PhoneOwner>,
  phone: string | null,
  matches: PhoneMatch[],
  decision: PhoneDecision | null,
): Promise<PhoneSaveResult> {
  const link = decision?.mode === "link" ? decision : null;
  const { data, error } = await supabase.rpc("update_phone", {
    p_kind: owner.kind,
    p_id: owner.id,
    p_phone: (phone ?? null) as unknown as string,
    p_acknowledged: acknowledged(matches, decision),
    p_link_id: (link?.targetId ?? null) as unknown as string,
    p_role_ids: link?.roleIds ?? [],
  });
  if (error) throw error;
  return asResult(data);
}

/** Vincula persona y empresa con funciones. Nunca da permisos de compra. */
export async function linkWithRoles(supabase: BrowserClient, contactId: string, companyId: string, roleIds: string[]) {
  const { error } = await supabase.rpc("link_contact_to_company", {
    p_contact_id: contactId,
    p_company_id: companyId,
    p_role_ids: roleIds,
  });
  if (error) throw error;
}

/** Empresas con el mismo teléfono que la persona, sin vínculo y sin descartar (aviso del chat). */
export async function fetchCompanyPhoneMatches(supabase: BrowserClient, contactId: string) {
  const { data, error } = await supabase.rpc("company_phone_matches", { p_contact_id: contactId });
  if (error) throw error;
  return data;
}

/** Descartar el aviso para ese par persona–empresa (no vuelve a aparecer). */
export async function dismissPhoneMatch(supabase: BrowserClient, contactId: string, companyId: string, userId: string) {
  const { error } = await supabase
    .from("phone_match_dismissals")
    .upsert(
      { contact_id: contactId, company_id: companyId, dismissed_by: userId },
      { onConflict: "contact_id,company_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Evento para que las listas de vínculos se recarguen tras vincular desde otro lugar. */
export const LINKS_CHANGED_EVENT = "crm:vinculos-cambiaron";
export function notifyLinksChanged() {
  window.dispatchEvent(new Event(LINKS_CHANGED_EVENT));
}
