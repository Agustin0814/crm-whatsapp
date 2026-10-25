import type { Json, Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;
export type Tag = Tables<"tags">;
export type Contact = Tables<"contacts">;
export type Conversation = Tables<"conversations">;
export type Message = Tables<"messages">;
export type Note = Tables<"notes">;
export type QuickReply = Tables<"quick_replies">;

export type Role = "admin" | "agent";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  agent: "Agente",
};

/** Contacto con sus etiquetas ya aplanadas. */
export type ContactWithTags = Contact & { tags: Tag[] };

/** Conversación tal como se muestra en la bandeja. */
export type ConversationItem = Conversation & { contact: ContactWithTags | null };

/** Nota interna con el nombre del autor. */
export type NoteWithAuthor = Note & { author: Pick<Profile, "id" | "full_name"> | null };

// --- Estados de conversación -------------------------------------------------

export const CONVERSATION_STATUSES = ["open", "pending", "resolved", "archived"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: "Abierta",
  pending: "Pendiente",
  resolved: "Resuelta",
  archived: "Archivada",
};

export function isConversationStatus(value: string): value is ConversationStatus {
  return (CONVERSATION_STATUSES as readonly string[]).includes(value);
}

// --- Campos personalizados (contacts.custom_fields) --------------------------

export type CustomFields = Record<string, string>;

/** Lee custom_fields (jsonb) como un mapa de texto, ignorando valores no válidos. */
export function parseCustomFields(value: Json): CustomFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: CustomFields = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;
    result[key] = typeof raw === "string" ? raw : JSON.stringify(raw);
  }
  return result;
}

// --- Etiquetas ---------------------------------------------------------------

/** Colores sugeridos al crear etiquetas (también se acepta cualquier hex). */
export const TAG_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
] as const;

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
