import { NextResponse, type NextRequest } from "next/server";
import { isWindowOpen } from "@/lib/conversation-window";
import {
  BUCKET_LIMIT_BYTES,
  detectMime,
  MEDIA_BUCKET,
  SEND_RULES,
  SNIFF_BYTES,
  sanitizeFilename,
  validateForSend,
} from "@/lib/media/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendMediaMessage, uploadMediaToMeta, WhatsAppApiError } from "@/lib/whatsapp/send";

// Descarga de Storage + subida a Meta de archivos de hasta 50 MB.
export const maxDuration = 60;

/** Límite de la leyenda en la Cloud API. */
const MAX_CAPTION = 1024;

type Body = { conversationId?: unknown; path?: unknown; caption?: unknown; filename?: unknown };

function fail(status: number, error: string, code?: string) {
  return NextResponse.json({ error, code }, { status });
}

/**
 * Envía un archivo que el navegador YA subió a Storage (outbound/{user_id}/…).
 * Esta ruta nunca recibe el archivo en sí (Vercel limita el cuerpo a ~4.5 MB):
 * solo la ruta, la leyenda y la conversación.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Sesión.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "No autenticado");

  // 2. Datos de entrada.
  const body = (await request.json().catch(() => ({}))) as Body;
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const path = typeof body.path === "string" ? body.path : "";
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const clientFilename = typeof body.filename === "string" ? body.filename : null;

  if (!conversationId || !path) return fail(400, "Faltan la conversación o el archivo");
  if (caption.length > MAX_CAPTION) return fail(400, `La leyenda supera ${MAX_CAPTION} caracteres`);

  // 3. La ruta debe ser un archivo del propio usuario (outbound/{su id}/{uuid}.{ext}).
  const ownPath = new RegExp(`^outbound/${user.id}/[0-9a-f-]{36}\\.[a-z0-9]{2,5}$`);
  if (!ownPath.test(path)) return fail(403, "El archivo no pertenece a tu usuario");

  // 4. Conversación y ventana de 24 h (también para archivos).
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, last_inbound_at, contacts(wa_id)")
    .eq("id", conversationId)
    .maybeSingle();
  if (convError) return fail(500, "Error al leer la conversación");
  if (!conversation?.contacts) return fail(404, "Conversación no encontrada");
  if (!isWindowOpen(conversation.last_inbound_at)) {
    return fail(422, "La ventana de 24 h está cerrada. Solo puedes enviar una plantilla aprobada.", "WINDOW_CLOSED");
  }

  // 5. Descargar el archivo de Storage y validar el tipo REAL y el tamaño.
  const { data: file, error: downloadError } = await supabase.storage.from(MEDIA_BUCKET).download(path);
  if (downloadError || !file) return fail(404, "No se encontró el archivo subido");
  if (file.size > BUCKET_LIMIT_BYTES) return fail(413, "El archivo supera el límite del almacenamiento");

  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  // El nombre solo desempata formatos contenedor (docx/xlsx/pptx, doc/xls/ppt) y TXT.
  const mime = detectMime(head, clientFilename ?? path);
  const validation = validateForSend(mime, file.size);
  if (!validation.ok) {
    await removeUpload(path);
    return fail(415, validation.error);
  }
  const { kind } = validation;
  const filename = sanitizeFilename(clientFilename ?? `archivo`, validation.mime);
  const finalCaption = SEND_RULES[kind].caption && caption ? caption : null;

  // 6. Subir a Meta y enviar el mensaje (al número normalizado).
  const waId = conversation.contacts.wa_id;
  if (!waId) {
    await removeUpload(path);
    return fail(422, "Este contacto no tiene un número de WhatsApp vinculado");
  }
  let waMessageId: string;
  let metaMediaId: string;
  try {
    metaMediaId = await uploadMediaToMeta(file, validation.mime, filename);
    waMessageId = await sendMediaMessage(waId, kind, metaMediaId, {
      caption: finalCaption,
      filename: kind === "document" ? filename : null,
    });
  } catch (error) {
    await removeUpload(path);
    if (error instanceof WhatsAppApiError) {
      console.error(`[whatsapp-send-media] Meta rechazó el envío (código ${error.code ?? "?"})`);
      return fail(502, `WhatsApp rechazó el archivo: ${error.message}`);
    }
    console.error("[whatsapp-send-media] No se pudo contactar a la Cloud API");
    return fail(502, "No se pudo contactar a WhatsApp");
  }

  // 7. Guardar el mensaje. El trigger actualiza la conversación (vista previa, tipo).
  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      direction: "outbound",
      status: "sending",
      type: kind,
      body: finalCaption,
      sender_id: user.id,
      wa_message_id: waMessageId,
      media_id: metaMediaId,
      media_path: path,
      media_mime: validation.mime,
      media_filename: kind === "document" ? filename : null,
      media_size: file.size,
      media_status: "ready",
    })
    .select("*")
    .single();

  if (insertError) {
    console.error(`[whatsapp-send-media] Mensaje ${waMessageId} enviado pero no guardado`);
    return fail(500, "El archivo se envió pero no se pudo guardar");
  }

  return NextResponse.json({ message });
}

/**
 * Borra una subida que no se llegó a enviar (tipo inválido o Meta la rechazó).
 * Los usuarios no tienen permiso de borrar en Storage: lo hace el servidor.
 */
async function removeUpload(path: string) {
  const { error } = await createAdminClient().storage.from(MEDIA_BUCKET).remove([path]);
  if (error) console.error("[whatsapp-send-media] No se pudo borrar una subida descartada");
}
