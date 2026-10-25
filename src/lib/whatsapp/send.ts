import "server-only";
import { serverEnv } from "@/lib/env";

const GRAPH_URL = "https://graph.facebook.com/v25.0";

type GraphSendResponse = {
  messages?: { id: string }[];
  error?: {
    message?: string;
    code?: number;
    error_data?: { details?: string };
  };
};

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    readonly code: number | undefined,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

/**
 * Convierte un wa_id en el número que acepta la Cloud API como destinatario.
 *
 * México: Meta entrega los wa_id en el webhook como 521XXXXXXXXXX (con el "1"
 * del formato móvil antiguo), pero la lista de destinatarios y la API esperan
 * 52XXXXXXXXXX. Se quita ese "1" solo al enviar; contacts.wa_id se guarda tal
 * cual llega. Cualquier otro número se devuelve sin cambios.
 */
export function toSendableNumber(waId: string): string {
  if (/^521\d{10}$/.test(waId)) {
    return `52${waId.slice(-10)}`;
  }
  return waId;
}

/** Envía un mensaje de texto y devuelve el wa_message_id que asigna Meta. */
export async function sendTextMessage(to: string, body: string): Promise<string> {
  const response = await fetch(
    `${GRAPH_URL}/${serverEnv("WHATSAPP_PHONE_NUMBER_ID")}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv("WHATSAPP_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toSendableNumber(to),
        type: "text",
        text: { body, preview_url: false },
      }),
      cache: "no-store",
    },
  );

  const data = (await response.json().catch(() => ({}))) as GraphSendResponse;
  const waMessageId = data.messages?.[0]?.id;

  if (!response.ok || !waMessageId) {
    const detail =
      data.error?.error_data?.details ??
      data.error?.message ??
      `HTTP ${response.status}`;
    throw new WhatsAppApiError(detail, data.error?.code);
  }

  return waMessageId;
}

// --- Multimedia ------------------------------------------------------------------

type GraphMediaUploadResponse = { id?: string; error?: GraphSendResponse["error"] };

/**
 * Sube un archivo a Meta (POST /{phone-number-id}/media, multipart) y devuelve
 * el media id para usarlo en el mensaje.
 */
export async function uploadMediaToMeta(file: Blob, mime: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([file], { type: mime }), filename);

  const response = await fetch(`${GRAPH_URL}/${serverEnv("WHATSAPP_PHONE_NUMBER_ID")}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serverEnv("WHATSAPP_TOKEN")}` },
    body: form,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as GraphMediaUploadResponse;
  if (!response.ok || !data.id) {
    const detail = data.error?.error_data?.details ?? data.error?.message ?? `HTTP ${response.status}`;
    throw new WhatsAppApiError(detail, data.error?.code);
  }
  return data.id;
}

export type OutboundMediaKind = "image" | "audio" | "video" | "document" | "sticker";

/**
 * Envía un mensaje multimedia con un media id ya subido a Meta.
 * La leyenda solo aplica a imagen, video y documento; el nombre, a documentos.
 */
export async function sendMediaMessage(
  to: string,
  kind: OutboundMediaKind,
  mediaId: string,
  options: { caption?: string | null; filename?: string | null } = {},
): Promise<string> {
  const media: Record<string, string> = { id: mediaId };
  if (options.caption && (kind === "image" || kind === "video" || kind === "document")) media.caption = options.caption;
  if (options.filename && kind === "document") media.filename = options.filename;

  const response = await fetch(`${GRAPH_URL}/${serverEnv("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv("WHATSAPP_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toSendableNumber(to),
      type: kind,
      [kind]: media,
    }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as GraphSendResponse;
  const waMessageId = data.messages?.[0]?.id;
  if (!response.ok || !waMessageId) {
    const detail = data.error?.error_data?.details ?? data.error?.message ?? `HTTP ${response.status}`;
    throw new WhatsAppApiError(detail, data.error?.code);
  }
  return waMessageId;
}
