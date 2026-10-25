import type { createClient } from "@/lib/supabase/client";
import type {
  ContactWithTags,
  Conversation,
  ConversationItem,
  ConversationStatus,
  Contact,
  Tag,
} from "./types";

type BrowserClient = ReturnType<typeof createClient>;

/** Embedding de PostgREST: conversación + contacto + etiquetas del contacto. */
export const CONVERSATION_SELECT = "*, contacts(*, contact_tags(tags(*)))" as const;
export const CONTACT_SELECT = "*, contact_tags(tags(*))" as const;

export const PAGE_SIZE = 40;

// --- Normalización -----------------------------------------------------------

type RawContact = Contact & { contact_tags: { tags: Tag | null }[] };
type RawConversation = Conversation & { contacts: RawContact | null };

export function normalizeContact(raw: RawContact): ContactWithTags {
  const { contact_tags, ...contact } = raw;
  const tags = contact_tags
    .map((ct) => ct.tags)
    .filter((t): t is Tag => t !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { ...contact, tags };
}

export function normalizeConversation(raw: RawConversation): ConversationItem {
  const { contacts, ...conversation } = raw;
  return { ...conversation, contact: contacts ? normalizeContact(contacts) : null };
}

/** Orden de la bandeja: fijadas primero y luego por último mensaje (nulls al final). */
export function compareConversations(a: Conversation, b: Conversation): number {
  if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
  if (a.last_message_at !== b.last_message_at) {
    if (!a.last_message_at) return 1;
    if (!b.last_message_at) return -1;
    return b.last_message_at.localeCompare(a.last_message_at);
  }
  return a.id.localeCompare(b.id);
}

// --- Filtros -----------------------------------------------------------------

export type QuickFilter = "all" | "mine" | "unassigned" | "unread";
export type StatusFilter = "active" | "all" | ConversationStatus;

export type InboxFilters = {
  search: string;
  quick: QuickFilter;
  status: StatusFilter;
  tagIds: string[];
  /** Agente asignado (solo se aplica con quick = "all" o "unread"). */
  assigneeId: string | null;
  /** Fechas "AAAA-MM-DD" (inclusive) sobre la fecha del último mensaje. */
  from: string | null;
  to: string | null;
};

export const DEFAULT_FILTERS: InboxFilters = {
  search: "",
  quick: "all",
  status: "active",
  tagIds: [],
  assigneeId: null,
  from: null,
  to: null,
};

/** Cuántos filtros del panel (estado, etiquetas, agente, fechas) están activos. */
export function countAdvancedFilters(f: InboxFilters): number {
  return (
    (f.status !== "active" ? 1 : 0) +
    (f.tagIds.length > 0 ? 1 : 0) +
    (f.assigneeId ? 1 : 0) +
    (f.from || f.to ? 1 : 0)
  );
}

type SearchArgs = {
  p_search?: string;
  p_statuses?: string[];
  p_tag_ids?: string[];
  p_assigned_to?: string;
  p_unassigned?: boolean;
  p_unread_only?: boolean;
  p_from?: string;
  p_to?: string;
};

function toSearchArgs(f: InboxFilters, myId: string | null): SearchArgs {
  const args: SearchArgs = {};
  const search = f.search.trim();
  if (search) args.p_search = search;

  if (f.status === "all") args.p_statuses = ["open", "pending", "resolved", "archived"];
  else if (f.status !== "active") args.p_statuses = [f.status];
  // "active" = todas menos archivadas (comportamiento por defecto de la función).

  if (f.tagIds.length) args.p_tag_ids = f.tagIds;

  if (f.quick === "mine" && myId) args.p_assigned_to = myId;
  else if (f.quick === "unassigned") args.p_unassigned = true;
  else if (f.assigneeId) args.p_assigned_to = f.assigneeId;

  if (f.quick === "unread") args.p_unread_only = true;

  // Fechas locales → límites del día en la zona horaria del navegador.
  if (f.from) args.p_from = new Date(`${f.from}T00:00:00`).toISOString();
  if (f.to) {
    const end = new Date(`${f.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    args.p_to = end.toISOString();
  }
  return args;
}

// --- Consultas ---------------------------------------------------------------

/** Página de conversaciones que cumplen los filtros (RLS del usuario). */
export async function fetchConversationPage(
  supabase: BrowserClient,
  filters: InboxFilters,
  myId: string | null,
  offset: number,
): Promise<ConversationItem[]> {
  const { data, error } = await supabase
    .rpc("search_conversations", {
      ...toSearchArgs(filters, myId),
      p_limit: PAGE_SIZE,
      p_offset: offset,
    })
    .select(CONVERSATION_SELECT);
  if (error) throw error;
  return (data as unknown as RawConversation[]).map(normalizeConversation).sort(compareConversations);
}

/**
 * Devuelve la conversación si cumple los filtros actuales, o null.
 * Se usa con los eventos de Realtime para decidir si entra o sale de la lista.
 */
export async function fetchConversationIfMatches(
  supabase: BrowserClient,
  conversationId: string,
  filters: InboxFilters,
  myId: string | null,
): Promise<ConversationItem | null> {
  const { data, error } = await supabase
    .rpc("search_conversations", {
      ...toSearchArgs(filters, myId),
      p_conversation_id: conversationId,
      p_limit: 1,
    })
    .select(CONVERSATION_SELECT);
  if (error) throw error;
  const rows = data as unknown as RawConversation[];
  return rows[0] ? normalizeConversation(rows[0]) : null;
}

/** Conversación por id sin aplicar filtros (para abrirla desde /contactos). */
export async function fetchConversationById(
  supabase: BrowserClient,
  conversationId: string,
): Promise<ConversationItem | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeConversation(data as unknown as RawConversation) : null;
}
