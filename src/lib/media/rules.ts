// Reglas de multimedia compartidas por el navegador y el servidor.
// Se valida SIEMPRE el tipo real a partir de los primeros bytes del archivo
// ("números mágicos"), nunca solo el nombre, la extensión o file.type.

export const MEDIA_BUCKET = "whatsapp-media";

/** Límite por archivo del bucket (plan gratuito de Supabase: 50 MB). */
export const BUCKET_LIMIT_BYTES = 50 * 1024 * 1024;

export type MediaKind = "image" | "audio" | "video" | "document" | "sticker";

export const MEDIA_KINDS: readonly MediaKind[] = ["image", "audio", "video", "document", "sticker"];

export function isMediaKind(type: string): type is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(type);
}

const MB = 1024 * 1024;

/**
 * Límites de la Cloud API para ENVIAR. Los documentos admiten 100 MB en Meta,
 * pero el bucket los limita a 50 MB.
 */
export const SEND_RULES: Record<MediaKind, { mimes: readonly string[]; maxBytes: number; label: string; caption: boolean }> = {
  image: { mimes: ["image/jpeg", "image/png"], maxBytes: 5 * MB, label: "Imagen (JPEG o PNG)", caption: true },
  audio: {
    mimes: ["audio/aac", "audio/mpeg", "audio/mp4", "audio/amr", "audio/ogg"],
    maxBytes: 16 * MB,
    label: "Audio (AAC, MP3, M4A, AMR u OGG/Opus)",
    caption: false,
  },
  video: { mimes: ["video/mp4", "video/3gpp"], maxBytes: 16 * MB, label: "Video (MP4 o 3GPP)", caption: true },
  document: {
    mimes: [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxBytes: Math.min(100 * MB, BUCKET_LIMIT_BYTES),
    label: "Documento (PDF, TXT, Word, Excel o PowerPoint)",
    caption: true,
  },
  // Meta: stickers WebP de 512×512; estáticos ≤ 100 KB y animados ≤ 500 KB.
  sticker: { mimes: ["image/webp"], maxBytes: 500 * 1024, label: "Sticker (WebP)", caption: false },
};

/** Extensión segura para guardar en Storage según el MIME (sin parámetros). */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** "audio/ogg; codecs=opus" → "audio/ogg". */
export function baseMime(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0].trim().toLowerCase();
}

export function extensionFor(mime: string | null | undefined): string {
  return EXTENSIONS[baseMime(mime)] ?? "bin";
}

/**
 * Tipos que el navegador ejecutaría o interpretaría (HTML, SVG, XML, JS).
 * Se guardan como application/octet-stream para que nunca se rendericen.
 */
const DANGEROUS_MIMES = ["text/html", "application/xhtml+xml", "image/svg+xml", "text/xml", "application/xml", "text/javascript", "application/javascript"];

export function safeContentType(mime: string | null | undefined): string {
  const base = baseMime(mime);
  if (!base || DANGEROUS_MIMES.includes(base)) return "application/octet-stream";
  return base;
}

// --- Detección del tipo real -------------------------------------------------

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}
function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

/** Bytes que hay que leer del principio del archivo para detectar el tipo. */
export const SNIFF_BYTES = 64;

/**
 * Detecta el MIME real por la firma del archivo. `name` solo se usa para
 * distinguir formatos contenedor (ZIP de Office, OLE de Office antiguo) y
 * texto plano, que no tienen una firma propia.
 */
export function detectMime(bytes: Uint8Array, name = ""): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 4) === "%PDF") return "application/pdf";
  if (ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(bytes, 0, 5) === "#!AMR") return "audio/amr";
  if (ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";

  // Contenedor ISO (MP4/M4A/3GP): "ftyp" en el byte 4 y la marca en el 8.
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (brand.startsWith("M4A") || brand.startsWith("M4B")) return "audio/mp4";
    if (brand.startsWith("3gp") || brand.startsWith("3g2")) return "video/3gpp";
    return "video/mp4";
  }

  // Tramas de audio sin cabecera: AAC ADTS (FFF1/FFF9) y MP3 (FFEx/FFFx con capa ≠ 0).
  if (bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9)) return "audio/aac";
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0) return "audio/mpeg";

  // Office moderno (ZIP) y antiguo (OLE): la extensión decide cuál de ellos.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const zipTypes: Record<string, string> = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
    return zipTypes[ext] ?? "application/zip";
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    const oleTypes: Record<string, string> = {
      doc: "application/msword",
      xls: "application/vnd.ms-excel",
      ppt: "application/vnd.ms-powerpoint",
    };
    return oleTypes[ext] ?? "application/x-ole-storage";
  }

  // Texto plano: solo .txt y sin bytes de control binarios.
  if (ext === "txt" && bytes.length > 0 && bytes.every((b) => b === 9 || b === 10 || b === 13 || b >= 32)) {
    return "text/plain";
  }
  return null;
}

// --- Validación para enviar ----------------------------------------------------

export type MediaValidation =
  | { ok: true; kind: MediaKind; mime: string }
  | { ok: false; error: string };

function formatLimit(bytes: number): string {
  return bytes >= MB ? `${Math.round(bytes / MB)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** Decide el tipo de envío a partir del MIME real y comprueba el tamaño. */
export function validateForSend(mime: string | null, size: number): MediaValidation {
  if (!mime) {
    return {
      ok: false,
      error: "No se reconoce el tipo de archivo. Se admiten imágenes JPEG/PNG, audio, video MP4, PDF, documentos de Office, TXT y stickers WebP.",
    };
  }
  const kind = (Object.keys(SEND_RULES) as MediaKind[]).find((k) => SEND_RULES[k].mimes.includes(mime));
  if (!kind) return { ok: false, error: `WhatsApp no admite este tipo de archivo (${mime}).` };
  const rule = SEND_RULES[kind];
  if (size <= 0) return { ok: false, error: "El archivo está vacío." };
  if (size > rule.maxBytes) {
    return { ok: false, error: `${rule.label}: el máximo es ${formatLimit(rule.maxBytes)} y el archivo pesa ${formatBytes(size)}.` };
  }
  return { ok: true, kind, mime };
}

// --- Utilidades ----------------------------------------------------------------

/** 1536 → "1.5 KB"; 5242880 → "5 MB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

/**
 * Nombre de archivo seguro para mostrar y para Meta (documentos): sin rutas,
 * sin caracteres de control ni reservados, longitud acotada y con la
 * extensión que corresponde al tipo REAL.
 */
export function sanitizeFilename(name: string | null | undefined, mime: string): string {
  const ext = extensionFor(mime);
  const raw = (name ?? "").split(/[\\/]/).pop() ?? "";
  const stem = raw
    .replace(/\.[^.]*$/, "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${stem || "archivo"}.${ext}`;
}
