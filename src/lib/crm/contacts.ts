import type { createClient } from "@/lib/supabase/client";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { CONTACT_SELECT, normalizeContact } from "./conversations";
import type { Contact, ContactWithTags, Tag } from "./types";

type BrowserClient = ReturnType<typeof createClient>;
type RawContact = Contact & { contact_tags: { tags: Tag | null }[] };

/** Actualiza campos del contacto y devuelve el contacto con sus etiquetas. */
export async function updateContact(
  supabase: BrowserClient,
  contactId: string,
  patch: TablesUpdate<"contacts">,
): Promise<ContactWithTags> {
  // wa_id nunca se edita desde la interfaz (lo controla el webhook).
  const { wa_id: _ignored, ...safePatch } = patch;
  void _ignored;
  const { data, error } = await supabase
    .from("contacts")
    .update(safePatch)
    .eq("id", contactId)
    .select(CONTACT_SELECT)
    .single();
  if (error) throw error;
  return normalizeContact(data as unknown as RawContact);
}

/** Contacto con sus etiquetas (para recargar la ficha tras un cambio hecho en la base). */
export async function fetchContact(supabase: BrowserClient, contactId: string): Promise<ContactWithTags> {
  const { data, error } = await supabase.from("contacts").select(CONTACT_SELECT).eq("id", contactId).single();
  if (error) throw error;
  return normalizeContact(data as unknown as RawContact);
}

/** Asigna (on = true) o quita una etiqueta de un contacto. Idempotente. */
export async function setContactTag(
  supabase: BrowserClient,
  contactId: string,
  tagId: string,
  on: boolean,
): Promise<void> {
  if (on) {
    const { error } = await supabase
      .from("contact_tags")
      .upsert({ contact_id: contactId, tag_id: tagId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("contact_tags")
      .delete()
      .eq("contact_id", contactId)
      .eq("tag_id", tagId);
    if (error) throw error;
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === "23505";
}

/**
 * Contacto que ya usa ese teléfono (misma normalización que el índice único:
 * 10 dígitos, 52 + 10 o 521 + 10 son el mismo número). Sirve para explicar un
 * duplicado con un enlace en lugar de un error técnico.
 */
export async function findContactByPhone(
  supabase: BrowserClient,
  phone: string,
  excludeId?: string,
): Promise<Pick<Contact, "id" | "name"> | null> {
  const { data: canonical, error: normError } = await supabase.rpc("normalize_phone", { p: phone });
  if (normError || !canonical) return null;
  let query = supabase
    .from("contacts")
    .select("id, name")
    .or(`phone_canonical.eq.${canonical},wa_id.eq.${canonical}`)
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.maybeSingle();
  return data;
}

/** Mensaje de error legible a partir de un error de Supabase. */
export function errorMessage(error: unknown, fallback = "Ocurrió un error"): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === "42501") return "No tienes permiso para esta acción";
    if (code === "23505") return "Ya existe un registro con ese valor";
  }
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message: unknown }).message);
    if (msg.includes("row-level security")) return "No tienes permiso para esta acción";
    if (msg) return msg;
  }
  return fallback;
}
