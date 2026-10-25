import "server-only";
import { serverEnv } from "@/lib/env";
import { BUCKET_LIMIT_BYTES, extensionFor, formatBytes, MEDIA_BUCKET, safeContentType } from "@/lib/media/rules";
import { createAdminClient } from "@/lib/supabase/admin";

const GRAPH_URL = "https://graph.facebook.com/v25.0";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Mensaje con archivo pendiente de traer desde Meta. */
export type InboundMediaRef = {
  id: string;
  conversation_id: string;
  media_id: string | null;
  media_mime: string | null;
};

export type StoreResult =
  | { ok: true; path: string; size: number; mime: string }
  | { ok: false; error: string };

/** Error con un motivo apto para mostrar al usuario (sin URLs ni tokens). */
class MediaError extends Error {}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${serverEnv("WHATSAPP_TOKEN")}`,
    // Algunos CDN de Meta rechazan peticiones sin User-Agent.
    "User-Agent": "lg-blocks-crm/1.0",
  };
}

/**
 * Descarga un archivo de Meta en dos pasos:
 *  1. GET /{media_id} → URL temporal (caduca en minutos), MIME y tamaño;
 *  2. GET a esa URL con el mismo token.
 */
async function downloadFromMeta(mediaId: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const infoRes = await fetch(`${GRAPH_URL}/${encodeURIComponent(mediaId)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!infoRes.ok) {
    throw new MediaError(
      infoRes.status === 404 || infoRes.status === 400
        ? "Meta ya no tiene este archivo (caducó o se eliminó)."
        : `Meta respondió ${infoRes.status} al pedir el archivo.`,
    );
  }
  const info = (await infoRes.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url) throw new MediaError("Meta no devolvió la dirección del archivo.");

  if (info.file_size && info.file_size > BUCKET_LIMIT_BYTES) {
    throw new MediaError(
      `El archivo pesa ${formatBytes(info.file_size)} y supera el límite de ${formatBytes(BUCKET_LIMIT_BYTES)} del almacenamiento.`,
    );
  }

  const fileRes = await fetch(info.url, { headers: authHeaders(), cache: "no-store" });
  if (!fileRes.ok) throw new MediaError(`Meta respondió ${fileRes.status} al descargar el archivo.`);
  const length = Number(fileRes.headers.get("content-length") ?? 0);
  if (length > BUCKET_LIMIT_BYTES) {
    throw new MediaError(`El archivo supera el límite de ${formatBytes(BUCKET_LIMIT_BYTES)} del almacenamiento.`);
  }
  const bytes = await fileRes.arrayBuffer();
  if (bytes.byteLength > BUCKET_LIMIT_BYTES) {
    throw new MediaError(`El archivo supera el límite de ${formatBytes(BUCKET_LIMIT_BYTES)} del almacenamiento.`);
  }
  return { bytes, mime: info.mime_type ?? fileRes.headers.get("content-type") ?? "application/octet-stream" };
}

/**
 * Trae el archivo de un mensaje entrante desde Meta, lo guarda en
 * inbound/{conversation_id}/{message_id}.{ext} y actualiza el mensaje
 * (ready o failed). NUNCA lanza: los fallos quedan en media_status/media_error.
 */
export async function storeInboundMedia(supabase: AdminClient, message: InboundMediaRef): Promise<StoreResult> {
  let result: StoreResult;
  try {
    if (!message.media_id) throw new MediaError("El mensaje no tiene archivo en Meta.");
    const { bytes, mime: metaMime } = await downloadFromMeta(message.media_id);
    const mime = message.media_mime ?? metaMime;
    const path = `inbound/${message.conversation_id}/${message.id}.${extensionFor(mime)}`;

    const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, {
      contentType: safeContentType(mime),
      upsert: true, // un reintento sobrescribe el mismo archivo
    });
    if (uploadError) throw new MediaError("No se pudo guardar el archivo en el almacenamiento.");

    result = { ok: true, path, size: bytes.byteLength, mime };
  } catch (error) {
    const reason = error instanceof MediaError ? error.message : "No se pudo descargar el archivo de Meta.";
    // Solo el id interno y el motivo: nunca URLs, tokens ni contenido.
    console.error(`[whatsapp-media] Mensaje ${message.id}: ${reason}`);
    result = { ok: false, error: reason };
  }

  const { error: updateError } = await supabase
    .from("messages")
    .update(
      result.ok
        ? { media_status: "ready", media_path: result.path, media_size: result.size, media_error: null }
        : { media_status: "failed", media_error: result.error },
    )
    .eq("id", message.id);
  if (updateError) console.error(`[whatsapp-media] Mensaje ${message.id}: no se pudo actualizar el estado`);

  return result;
}
