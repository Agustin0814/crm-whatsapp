import type { Json, Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;
export type Tag = Tables<"tags">;
export type Contact = Tables<"contacts">;
export type Conversation = Tables<"conversations">;
export type Message = Tables<"messages">;
export type Note = Tables<"notes">;
export type QuickReply = Tables<"quick_replies">;

export type ConversationEvent = Tables<"conversation_events">;
export type AppNotification = Tables<"notifications">;

// Roles y permisos: viven en src/lib/permissions.ts (compartido cliente/servidor).
export { ROLE_LABELS, isAdminRole, type Role } from "@/lib/permissions";

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

// --- Etapas del chat (independientes del estado y de la asignación) ---------

export const STAGES = ["sin_asignar", "ventas", "reparto"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  sin_asignar: "Sin asignar",
  ventas: "Ventas",
  reparto: "Reparto",
};

export function isStage(value: string | null | undefined): value is Stage {
  return (STAGES as readonly string[]).includes(value ?? "");
}

/** Acciones de etapa (public.change_conversation_stage). */
export type StageAction = "take" | "to_delivery" | "delivered" | "back_to_sales";

/** Texto de la línea de sistema del chat: «Pasó a Reparto por Ana». */
export const EVENT_LABELS: Record<string, string> = {
  a_ventas: "Pasó a Ventas",
  a_reparto: "Pasó a Reparto",
  entregado: "Entregado",
  devuelto_ventas: "Devuelto a Ventas",
  reasignado: "Reasignado",
};

// --- Clasificación (contactos y empresas) ------------------------------------

export const CLASSIFICATIONS = ["unclassified", "prospect", "customer", "supplier"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  unclassified: "Sin clasificar",
  prospect: "Prospecto",
  customer: "Cliente",
  supplier: "Proveedor",
};

export function isClassification(value: string | null | undefined): value is Classification {
  return (CLASSIFICATIONS as readonly string[]).includes(value ?? "");
}

/** Origen del último cambio de clasificación. */
export const CLASSIFICATION_SOURCE_LABELS: Record<string, string> = {
  default: "Por defecto",
  suggestion: "Sugerencia aceptada",
  manual: "Manual",
  order: "Por pedido (anterior)",
  purchase: "Por compra",
};

export type ClassificationEntity = "contact" | "company";
export type ClassificationHistoryEntry = Tables<"classification_history">;
export type ClassificationSuggestion = Tables<"classification_suggestions">;

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
