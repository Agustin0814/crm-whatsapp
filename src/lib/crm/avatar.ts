// Lógica ÚNICA de avatares (lista, encabezado del chat, ficha, contactos y usuarios).
//
// Bug corregido: antes se tomaba name[0] / charAt(0), que parte los emojis
// (son varios code units UTF-16) y mostraba "�". Ahora se recorre el texto por
// grafemas (lo que el usuario percibe como un carácter) con Intl.Segmenter.

export type AvatarSpec =
  | { kind: "emoji"; emoji: string }
  | { kind: "icon"; icon: "empresa" | "persona" }
  | { kind: "initials"; text: string };

export const AVATAR_PALETTE_SIZE = 8;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("es", { granularity: "grapheme" })
    : null;

/** Divide un texto en grafemas (emojis compuestos, banderas y acentos incluidos). */
export function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return Array.from(text); // respaldo: al menos no parte pares sustitutos
}

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const LETTER_OR_DIGIT_RE = /^[\p{L}\p{N}]/u;

function isEmoji(grapheme: string): boolean {
  return EMOJI_RE.test(grapheme);
}

/**
 * Decide qué mostrar en el avatar:
 *  1. Si el nombre empieza con un emoji → ese emoji completo.
 *  2. Si el contacto tiene empresa → icono «empresa».
 *  3. Si tiene un nombre normal → una o dos iniciales.
 *  4. Sin nombre → icono «persona».
 */
export function avatarFor(person: { name?: string | null; company?: string | null }): AvatarSpec {
  const name = person.name?.trim() ?? "";
  const first = name ? graphemes(name)[0] : undefined;
  if (first && isEmoji(first)) return { kind: "emoji", emoji: first };

  if (person.company?.trim()) return { kind: "icon", icon: "empresa" };

  // Solo palabras que empiezan con letra o número (ignora signos sueltos).
  const words = name.split(/\s+/).filter((w) => LETTER_OR_DIGIT_RE.test(w));
  if (words.length === 0) return { kind: "icon", icon: "persona" };

  const initial = (word: string) => (graphemes(word)[0] ?? "").toLocaleUpperCase("es");
  const text = words.length > 1 ? initial(words[0]) + initial(words[words.length - 1]) : initial(words[0]);
  return { kind: "initials", text };
}

/** Índice de color 1..8 estable a partir de una semilla (wa_id del contacto o id del usuario). */
export function avatarColorIndex(seed: string): number {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) | 0;
  return (Math.abs(hash) % AVATAR_PALETTE_SIZE) + 1;
}

/** Iniciales (o "?") para usos compactos sin icono, p. ej. el agente asignado. */
export function initialsOf(name: string | null | undefined): string {
  const spec = avatarFor({ name });
  if (spec.kind === "initials") return spec.text;
  if (spec.kind === "emoji") return spec.emoji;
  return "?";
}
