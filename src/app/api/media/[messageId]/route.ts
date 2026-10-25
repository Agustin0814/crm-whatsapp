import { NextResponse, type NextRequest } from "next/server";
import { MEDIA_BUCKET } from "@/lib/media/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { storeInboundMedia } from "@/lib/whatsapp/media";

// Puede descargar de Meta y subir a Storage (hasta 50 MB).
export const maxDuration = 60;

/** Duración de las URLs firmadas. Se piden bajo demanda y nunca se guardan. */
const SIGNED_URL_SECONDS = 60 * 60;
/** Un «pending» más reciente que esto probablemente lo está descargando el webhook. */
const PENDING_GRACE_MS = 45_000;

export type MediaResponse =
  | { status: "ready"; url: string; expiresAt: number; mime: string | null; filename: string | null; size: number | null }
  | { status: "pending" }
  | { status: "failed"; error: string };

/**
 * Devuelve una URL firmada de corta duración para el archivo de un mensaje.
 * Si aún no está descargado (pending antiguo o failed) y Meta todavía lo
 * tiene (≈30 días), lo intenta descargar de nuevo.
 *
 * ?download=1 → la URL fuerza la descarga (Content-Disposition: attachment).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/media/[messageId]">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { messageId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return NextResponse.json({ error: "Id no válido" }, { status: 400 });
  const forceDownload = request.nextUrl.searchParams.get("download") === "1";

  // Lectura con la sesión del usuario (RLS).
  const { data: message, error } = await supabase
    .from("messages")
    .select("id, conversation_id, type, direction, created_at, media_id, media_mime, media_path, media_status, media_filename, media_size, media_error")
    .eq("id", messageId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo leer el mensaje" }, { status: 500 });
  if (!message || !message.media_status) return NextResponse.json({ error: "El mensaje no tiene archivo" }, { status: 404 });

  let path = message.media_path;
  let size = message.media_size;
  let mime = message.media_mime;

  if (message.media_status !== "ready" || !path) {
    const age = Date.now() - new Date(message.created_at).getTime();
    if (message.media_status === "pending" && age < PENDING_GRACE_MS) {
      return NextResponse.json({ status: "pending" } satisfies MediaResponse);
    }
    // Solo se puede volver a traer lo que vino de Meta.
    if (message.direction !== "inbound" || !message.media_id) {
      return NextResponse.json({
        status: "failed",
        error: message.media_error ?? "El archivo no está disponible.",
      } satisfies MediaResponse);
    }
    // inbound/ solo lo escribe el servidor con la service role.
    const result = await storeInboundMedia(createAdminClient(), message);
    if (!result.ok) return NextResponse.json({ status: "failed", error: result.error } satisfies MediaResponse);
    path = result.path;
    size = result.size;
    mime = result.mime;
  }

  // Los documentos siempre se descargan: nunca se abren dentro del navegador.
  const download = forceDownload || message.type === "document" ? (message.media_filename ?? true) : undefined;
  const { data: signed, error: signError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, download !== undefined ? { download } : undefined);
  if (signError || !signed) {
    return NextResponse.json({ status: "failed", error: "No se pudo generar el enlace del archivo." } satisfies MediaResponse);
  }

  return NextResponse.json(
    {
      status: "ready",
      url: signed.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000,
      mime,
      filename: message.media_filename,
      size,
    } satisfies MediaResponse,
    // Contiene una URL firmada: que nadie la guarde en caché compartida.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
