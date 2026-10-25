import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { baseMime, isMediaKind, sanitizeFilename } from "@/lib/media/rules";
import { storeInboundMedia } from "./media";
import type {
  WaChangeValue,
  WaInboundMessage,
  WaMedia,
  WaStatus,
  WaWebhookPayload,
} from "./types";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Código de Postgres para violación de restricción única. */
const UNIQUE_VIOLATION = "23505";

/**
 * Procesa un payload ya validado del webhook. Se ejecuta después de haber
 * respondido 200 a Meta, así que nunca debe lanzar: los errores se registran
 * (sin datos sensibles) y se continúa con el siguiente evento.
 */
export async function processWebhookPayload(
  payload: WaWebhookPayload,
  phoneNumberId: string,
): Promise<void> {
  if (payload.object !== "whatsapp_business_account") return;

  const supabase = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;

      // Ignorar eventos de otros números de la misma cuenta.
      if (value.metadata?.phone_number_id !== phoneNumberId) continue;

      for (const message of value.messages ?? []) {
        try {
          await handleInboundMessage(supabase, value, message);
        } catch (error) {
          logError("mensaje entrante", message.id, error);
        }
      }

      for (const status of value.statuses ?? []) {
        try {
          await handleStatus(supabase, status);
        } catch (error) {
          logError("estado", status.id, error);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Mensajes entrantes
// ---------------------------------------------------------------------------

async function handleInboundMessage(
  supabase: AdminClient,
  value: WaChangeValue,
  message: WaInboundMessage,
): Promise<void> {
  // Las reacciones (emoji sobre un mensaje) se ignoran por ahora.
  if (message.type === "reaction") return;

  const profileName =
    value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name ??
    null;

  const contactId = await upsertContact(supabase, message.from, profileName);
  const conversationId = await getOrCreateConversation(supabase, contactId);

  const media = isMediaKind(message.type) ? getMedia(message) : undefined;
  const mime = media?.mime_type ? baseMime(media.mime_type) : null;
  const row: TablesInsert<"messages"> = {
    conversation_id: conversationId,
    direction: "inbound",
    status: "received",
    type: message.type,
    body: getBody(message),
    media_id: media?.id ?? null,
    media_mime: mime,
    // El nombre solo llega en documentos; se sanea y se ajusta al tipo real.
    media_filename: message.type === "document" && mime ? sanitizeFilename(media?.filename, mime) : null,
    media_status: media ? "pending" : null,
    wa_message_id: message.id,
    wa_timestamp: unixToIso(message.timestamp),
  };

  // ON CONFLICT (wa_message_id) DO NOTHING: los reintentos de Meta se ignoran
  // y el trigger de conversations no se dispara dos veces. Solo devuelve la
  // fila si se insertó (en un duplicado viene vacío y no se descarga otra vez).
  const { data: inserted, error } = await supabase
    .from("messages")
    .upsert(row, { onConflict: "wa_message_id", ignoreDuplicates: true })
    .select("id, conversation_id, media_id, media_mime");
  if (error) throw error;

  // Descarga del archivo: corre dentro del after() del webhook, así que Meta
  // ya recibió su 200. storeInboundMedia nunca lanza ni reintenta en bucle.
  const created = inserted?.[0];
  if (created && media) await storeInboundMedia(supabase, created);
}

/**
 * Devuelve el id del contacto de este wa_id. La función de la base
 * (upsert_whatsapp_contact) busca por wa_id; si no existe, vincula un contacto
 * creado a mano con el mismo teléfono normalizado, y si tampoco, lo crea.
 * Solo completa el nombre si estaba vacío (no pisa uno editado en el CRM).
 */
async function upsertContact(
  supabase: AdminClient,
  waId: string,
  profileName: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_whatsapp_contact", {
    p_wa_id: waId,
    p_name: profileName ?? "",
  });
  if (error) throw error;
  return data;
}

/** Devuelve la conversación del contacto (hay una por contacto) o la crea. */
async function getOrCreateConversation(
  supabase: AdminClient,
  contactId: string,
): Promise<string> {
  const existing = await findConversation(supabase, contactId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ contact_id: contactId })
    .select("id")
    .single();

  if (!error) return data.id;

  // Dos webhooks simultáneos pueden intentar crearla a la vez.
  if (error.code === UNIQUE_VIOLATION) {
    const created = await findConversation(supabase, contactId);
    if (created) return created;
  }
  throw error;
}

async function findConversation(
  supabase: AdminClient,
  contactId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

function getMedia(message: WaInboundMessage): WaMedia | undefined {
  return (
    message.image ??
    message.video ??
    message.audio ??
    message.document ??
    message.sticker
  );
}

/**
 * Texto que se guarda en body:
 *  - texto: el mensaje; multimedia: la leyenda (si la hay);
 *  - otros tipos (no compatibles todavía): una descripción legible, para que
 *    nunca se muestre una burbuja vacía.
 */
function getBody(message: WaInboundMessage): string | null {
  switch (message.type) {
    case "text":
      return message.text?.body ?? null;
    case "image":
    case "video":
    case "document":
      return getMedia(message)?.caption?.trim() || null;
    case "audio":
    case "sticker":
      return null;
    case "button":
      return message.button?.text ? `Botón: ${message.button.text}` : "Respuesta de botón";
    case "interactive": {
      const title = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title;
      return title ? `Respuesta: ${title}` : "Respuesta interactiva";
    }
    case "location": {
      const loc = message.location;
      if (!loc) return "Ubicación";
      const label = [loc.name, loc.address].filter(Boolean).join(" - ");
      return `Ubicación: ${label ? `${label} ` : ""}(${loc.latitude}, ${loc.longitude})`;
    }
    case "contacts": {
      const names = (message.contacts ?? [])
        .map((c) => c.name?.formatted_name ?? c.phones?.[0]?.phone)
        .filter(Boolean);
      return names.length ? `Contacto compartido: ${names.join(", ")}` : "Contacto compartido";
    }
    case "order": {
      const items = message.order?.product_items?.length ?? 0;
      return `Pedido con ${items} producto${items === 1 ? "" : "s"}`;
    }
    case "unsupported":
      return "WhatsApp no permite ver este tipo de mensaje en el CRM";
    default:
      return `Mensaje de tipo «${message.type}»`;
  }
}

// ---------------------------------------------------------------------------
// Estados de mensajes salientes
// ---------------------------------------------------------------------------

/**
 * Estados previos desde los que se permite pasar a cada estado nuevo.
 * Meta no garantiza el orden de los eventos (puede llegar "read" antes que
 * "delivered"), así que nunca se retrocede.
 */
const ALLOWED_PREVIOUS: Record<string, string[]> = {
  sent: ["sending"],
  delivered: ["sending", "sent"],
  read: ["sending", "sent", "delivered"],
  failed: ["sending", "sent", "delivered"],
};

async function handleStatus(
  supabase: AdminClient,
  status: WaStatus,
): Promise<void> {
  const allowedPrevious = ALLOWED_PREVIOUS[status.status];
  if (!allowedPrevious) return; // estado desconocido: se ignora

  const update =
    status.status === "failed"
      ? { status: "failed", error: describeError(status) }
      : { status: status.status };

  // Si el mensaje no existe (enviado fuera del CRM) no se actualiza nada.
  const { error } = await supabase
    .from("messages")
    .update(update)
    .eq("wa_message_id", status.id)
    .in("status", allowedPrevious);
  if (error) throw error;
}

function describeError(status: WaStatus): string {
  const err = status.errors?.[0];
  if (!err) return "Error desconocido";
  const detail = err.error_data?.details ?? err.message ?? err.title ?? "";
  return `${err.code}${detail ? `: ${detail}` : ""}`;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function unixToIso(seconds: string): string | null {
  const n = Number(seconds);
  return Number.isFinite(n) ? new Date(n * 1000).toISOString() : null;
}

/** Registra el error sin volcar el payload (contiene datos personales). */
function logError(kind: string, waMessageId: string, error: unknown): void {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "desconocido";
  console.error(`[whatsapp-webhook] Error procesando ${kind} ${waMessageId}: ${detail}`);
}
