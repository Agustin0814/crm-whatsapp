import type { createClient } from "@/lib/supabase/client";
import { SUPABASE_ANON_KEY } from "@/lib/supabase/public-env";
import { detectMime, extensionFor, MEDIA_BUCKET, SNIFF_BYTES, validateForSend, type MediaValidation } from "./rules";

type BrowserClient = ReturnType<typeof createClient>;

/** Valida un archivo en el navegador leyendo sus primeros bytes (tipo real). */
export async function validateFile(file: File): Promise<MediaValidation> {
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  return validateForSend(detectMime(head, file.name), file.size);
}

export class UploadAbortedError extends Error {}

/**
 * Sube el archivo DIRECTO a Supabase Storage (nunca pasa por Next/Vercel):
 *  1. pide una URL firmada de subida para outbound/{user_id}/{uuid}.{ext}
 *     (la política de Storage solo lo permite en la carpeta del propio usuario);
 *  2. hace el PUT con XMLHttpRequest para poder informar el progreso.
 * El nombre del archivo en Storage es aleatorio: no se confía en el del usuario.
 */
export async function uploadOutboundFile(
  supabase: BrowserClient,
  userId: string,
  file: File,
  mime: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const path = `outbound/${userId}/${crypto.randomUUID()}.${extensionFor(mime)}`;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("No se pudo preparar la subida del archivo.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.signedUrl);
    xhr.setRequestHeader("content-type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY); // clave pública
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.status === 413 ? "El archivo supera el límite del almacenamiento." : "No se pudo subir el archivo."));
    };
    xhr.onerror = () => reject(new Error("Error de red al subir el archivo."));
    xhr.onabort = () => reject(new UploadAbortedError("Subida cancelada."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });

  onProgress(1);
  return path;
}
