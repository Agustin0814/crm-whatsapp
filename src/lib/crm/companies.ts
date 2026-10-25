import type { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import type { Contact, Tag } from "./types";

type BrowserClient = ReturnType<typeof createClient>;

export type Company = Tables<"companies">;
export type ContactRole = Tables<"contact_roles">;
export type PersonCompanyLink = Tables<"person_company_links">;

export type CompanyWithTags = Company & { tags: Tag[] };

/** Vínculo persona–empresa con sus funciones y la otra parte ya cargada. */
export type LinkWithRoles = PersonCompanyLink & {
  roles: ContactRole[];
  company: Pick<Company, "id" | "trade_name" | "classification"> | null;
  contact: Pick<Contact, "id" | "name" | "wa_id" | "phone" | "classification"> | null;
};

export const PAYMENT_TERMS_LABELS: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito",
};

const COMPANY_SELECT = "*, company_tags(tags(*))" as const;
const LINK_SELECT =
  "*, link_roles(contact_roles(*)), companies(id, trade_name, classification), contacts(id, name, wa_id, phone, classification)" as const;

type RawCompany = Company & { company_tags: { tags: Tag | null }[] };
type RawLink = PersonCompanyLink & {
  link_roles: { contact_roles: ContactRole | null }[];
  companies: LinkWithRoles["company"];
  contacts: LinkWithRoles["contact"];
};

function normalizeCompany(raw: RawCompany): CompanyWithTags {
  const { company_tags, ...company } = raw;
  const tags = company_tags
    .map((ct) => ct.tags)
    .filter((t): t is Tag => t !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { ...company, tags };
}

function normalizeLink(raw: RawLink): LinkWithRoles {
  const { link_roles, companies, contacts, ...link } = raw;
  const roles = link_roles
    .map((lr) => lr.contact_roles)
    .filter((r): r is ContactRole => r !== null)
    .sort((a, b) => a.sort_order - b.sort_order);
  return { ...link, roles, company: companies, contact: contacts };
}

// --- Empresas ------------------------------------------------------------------

export async function fetchCompany(supabase: BrowserClient, id: string): Promise<CompanyWithTags | null> {
  const { data, error } = await supabase.from("companies").select(COMPANY_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? normalizeCompany(data as unknown as RawCompany) : null;
}

/** Empresas cuyo nombre comercial o razón social contienen el texto (para el selector). */
export async function searchCompanies(
  supabase: BrowserClient,
  search: string,
  limit = 20,
): Promise<Pick<Company, "id" | "trade_name" | "legal_name" | "city">[]> {
  let query = supabase.from("companies").select("id, trade_name, legal_name, city").order("trade_name").limit(limit);
  const term = search.trim().replace(/[%_,()]/g, " ");
  if (term) query = query.or(`trade_name.ilike.%${term}%,legal_name.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Crea una empresa. Para un usuario que no es administrador la base fuerza
 * «contado» sin crédito aunque se envíe otra cosa.
 */
export async function createCompany(
  supabase: BrowserClient,
  values: TablesInsert<"companies">,
): Promise<Company> {
  const { data, error } = await supabase.from("companies").insert(values).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateCompany(
  supabase: BrowserClient,
  id: string,
  patch: TablesUpdate<"companies">,
): Promise<CompanyWithTags> {
  const { data, error } = await supabase.from("companies").update(patch).eq("id", id).select(COMPANY_SELECT).single();
  if (error) throw error;
  return normalizeCompany(data as unknown as RawCompany);
}

/** Asigna (on = true) o quita una etiqueta de una empresa. Idempotente. */
export async function setCompanyTag(supabase: BrowserClient, companyId: string, tagId: string, on: boolean) {
  if (on) {
    const { error } = await supabase
      .from("company_tags")
      .upsert({ company_id: companyId, tag_id: tagId }, { onConflict: "company_id,tag_id", ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("company_tags").delete().eq("company_id", companyId).eq("tag_id", tagId);
    if (error) throw error;
  }
}

// --- Vínculos persona–empresa -----------------------------------------------------

export async function fetchLinks(
  supabase: BrowserClient,
  by: { contactId: string } | { companyId: string },
): Promise<LinkWithRoles[]> {
  let query = supabase.from("person_company_links").select(LINK_SELECT).order("created_at");
  query = "contactId" in by ? query.eq("contact_id", by.contactId) : query.eq("company_id", by.companyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as RawLink[]).map(normalizeLink);
}

/**
 * Vincula una persona con una empresa. Si ya hubo un vínculo (desactivado), se
 * reactiva en lugar de duplicarlo. Los permisos de pedido los da un administrador.
 */
export async function linkContactToCompany(supabase: BrowserClient, contactId: string, companyId: string) {
  const { data: existing, error: findError } = await supabase
    .from("person_company_links")
    .select("id")
    .eq("contact_id", contactId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    const { error } = await supabase.from("person_company_links").update({ is_active: true }).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase
    .from("person_company_links")
    .insert({ contact_id: contactId, company_id: companyId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Desvincular = desactivar (se conserva el historial de pedidos hechos por esa persona). */
export async function setLinkActive(supabase: BrowserClient, linkId: string, active: boolean) {
  const { error } = await supabase.from("person_company_links").update({ is_active: active }).eq("id", linkId);
  if (error) throw error;
}

/** Permisos de pedido del vínculo. La base solo los acepta de un administrador. */
export async function updateLinkPermissions(
  supabase: BrowserClient,
  linkId: string,
  patch: Pick<TablesUpdate<"person_company_links">, "can_order" | "order_limit" | "requires_authorization">,
) {
  const { error } = await supabase.from("person_company_links").update(patch).eq("id", linkId);
  if (error) throw error;
}

export async function setLinkRole(supabase: BrowserClient, linkId: string, roleId: string, on: boolean) {
  if (on) {
    const { error } = await supabase
      .from("link_roles")
      .upsert({ link_id: linkId, role_id: roleId }, { onConflict: "link_id,role_id", ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("link_roles").delete().eq("link_id", linkId).eq("role_id", roleId);
    if (error) throw error;
  }
}
