// Contrato del Asistente de notas con el modelo y su validación (lógica pura,
// sin base ni red: la usan el motor y las pruebas). El modelo devuelve UNA
// llamada a «registrar_notas»; el servidor decide qué se guarda.

import { foldText } from "./guards";
import type { NotesCaptureKey } from "./notes-config";
import type { ToolDefinition } from "./provider";

export const NOTES_TOOL_NAME = "registrar_notas";
export const MAX_NOTES_PER_RUN = 3;
export const NOTE_MAX_CHARS = 280;
export const MAX_COUNTERS = 12;
const COUNTER_ITEM_MAX = 60;
/** Parecido (palabras compartidas) a partir del cual una nota se considera repetida. */
const NEAR_DUPLICATE = 0.75;
/** Parte de las palabras de una nota corta que ya están en otra: entonces no aporta nada nuevo. */
const CONTAINED = 0.6;

export const SENSITIVE_PLACEHOLDER = "[dato sensible omitido]";

/** Tipo de cada nota → casilla del panel que la habilita. */
export const NOTE_KINDS = ["entrega", "producto", "solicitud", "queja", "contacto", "otro"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

const KIND_TO_CAPTURE: Record<NoteKind, NotesCaptureKey | null> = {
  entrega: "delivery",
  producto: "products",
  solicitud: "special_requests",
  queja: "complaints",
  contacto: "contact_data",
  otro: null,
};

export const NOTES_TOOL: ToolDefinition = {
  name: NOTES_TOOL_NAME,
  description:
    "Registra de 0 a 3 notas internas nuevas y el resumen actualizado del cliente. Nunca se envía nada al cliente.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["notas", "resumen", "resumen_cambio", "contadores"],
    properties: {
      notas: {
        type: "array",
        description: "De 0 a 3 hechos nuevos y útiles para el equipo. Vacío si no hay nada relevante.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["tipo", "texto"],
          properties: {
            tipo: { type: "string", enum: [...NOTE_KINDS] },
            texto: { type: "string", description: "Una sola idea, breve (máx. 280 caracteres)." },
          },
        },
      },
      resumen: { type: "string", description: "Resumen completo y actualizado del cliente (reemplaza al anterior)." },
      resumen_cambio: { type: "boolean", description: "true si el resumen cambió respecto al actual." },
      contadores: {
        type: "array",
        description: "Productos o medidas de interés y cuántas veces los pidió (aproximado), acumulado.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["item", "veces"],
          properties: {
            item: { type: "string" },
            veces: { type: "integer" },
          },
        },
      },
    },
  },
};

export type Counter = { item: string; count: number };

export type NotesPlan = {
  notes: { kind: NoteKind; text: string }[];
  summary: string;
  summaryChanged: boolean;
  counters: Counter[];
};

/** Convierte los argumentos del modelo; lo que no tenga forma válida se descarta. */
export function parseNotesPlan(args: Record<string, unknown>): NotesPlan {
  const notes = Array.isArray(args.notas)
    ? args.notas.flatMap((n) => {
        if (!n || typeof n !== "object") return [];
        const { tipo, texto } = n as Record<string, unknown>;
        if (typeof texto !== "string") return [];
        const kind = NOTE_KINDS.includes(tipo as NoteKind) ? (tipo as NoteKind) : "otro";
        return [{ kind, text: texto }];
      })
    : [];
  const counters = Array.isArray(args.contadores)
    ? args.contadores.flatMap((c) => {
        if (!c || typeof c !== "object") return [];
        const { item, veces } = c as Record<string, unknown>;
        const count = typeof veces === "number" ? veces : Number(veces);
        return typeof item === "string" && Number.isFinite(count) ? [{ item, count }] : [];
      })
    : [];
  return {
    notes,
    summary: typeof args.resumen === "string" ? args.resumen : "",
    summaryChanged: args.resumen_cambio === true,
    counters,
  };
}

// ---------------------------------------------------------------------------
// Datos sensibles
// ---------------------------------------------------------------------------

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g;
const SECRET_RE =
  /\b(contrase(?:ñ|n)a|password|passw|clave de acceso|nip|pin|cvv|cvc|c[oó]digo de (?:verificaci[oó]n|seguridad|acceso))\b(\s*(?:es|era|:|=)?\s*)(\S+)/giu;
/** Vencimiento de tarjeta cerca de «vence», «vencimiento», «exp», «caduca»: «vence 08/29». */
const EXPIRY_RE = /\b(vence|vencimiento|vto|exp|expira\w*|caduca\w*)(?![\p{L}\p{N}])([^\d\n]{0,15}?)\d{1,2}\s*[/-]\s*\d{2,4}\b/giu;
const CURP_RE = /\b[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d\b/giu;
const ELECTOR_RE = /\b[A-Z]{6}\d{8}[HMX]\d{3}\b/giu;

/**
 * Quita números de tarjeta (validados con Luhn) y su vencimiento, contraseñas,
 * NIP, códigos de verificación y documentos de identidad (CURP, clave de elector). Se aplica a
 * lo que entra al modelo Y a lo que sale de él (notas y resumen).
 */
export function redactSensitive(text: string): string {
  return text
    .replace(CARD_RE, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhnValid(digits) ? SENSITIVE_PLACEHOLDER : match;
    })
    .replace(SECRET_RE, (_m, label: string, sep: string) => `${label}${sep}${SENSITIVE_PLACEHOLDER}`)
    .replace(EXPIRY_RE, (_m, label: string, sep: string) => `${label}${sep}${SENSITIVE_PLACEHOLDER}`)
    .replace(CURP_RE, SENSITIVE_PLACEHOLDER)
    .replace(ELECTOR_RE, SENSITIVE_PLACEHOLDER);
}

// ---------------------------------------------------------------------------
// Duplicados
// ---------------------------------------------------------------------------

/** Texto normalizado para comparar: sin acentos, mayúsculas ni signos. */
export function normalizeNote(text: string): string {
  return foldText(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): Set<string> {
  return new Set(normalizeNote(text).split(" ").filter((w) => w.length > 1));
}

/** Parecido entre 0 y 1 (Jaccard de palabras). */
export function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return normalizeNote(a) === normalizeNote(b) ? 1 : 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common += 1;
  return common / (wa.size + wb.size - common);
}

/** Qué parte de las palabras significativas de `a` (3+ letras) aparece en `b`. */
export function containment(a: string, b: string): number {
  const wa = [...words(a)].filter((w) => w.length > 2);
  if (!wa.length) return 0;
  const wb = words(b);
  return wa.filter((w) => wb.has(w)).length / wa.length;
}

/**
 * Repetida: igual, muy parecida, o una nota más corta cuyos datos ya están casi
 * todos en otra (p. ej. «Teléfono: 644…» cuando la nota de entrega ya lo trae).
 */
export function isNearDuplicate(text: string, existing: string[]): boolean {
  const n = normalizeNote(text);
  return existing.some(
    (e) =>
      normalizeNote(e) === n ||
      similarity(text, e) >= NEAR_DUPLICATE ||
      (n.length < normalizeNote(e).length && containment(text, e) >= CONTAINED),
  );
}

// ---------------------------------------------------------------------------
// Mensajes sin información
// ---------------------------------------------------------------------------

const TRIVIAL_RE =
  /^(hola+|ola|buen[oa]s?( (dias|tardes|noches))?|que tal|gracias|muchas gracias|mil gracias|ok+|okay|oki|va|vale|sale|si|no|listo|perfecto|de acuerdo|claro|bye|adios|hasta luego|saludos|igualmente|a sus ordenes|ah ok|👍|🙏|👌|😊|🙂)( (gracias|amigo|amiga|joven|senor|senora|buen dia))?$/u;

/** true si el texto no aporta información (saludos, agradecimientos, «ok»). */
export function isTrivialText(body: string | null): boolean {
  if (!body) return false;
  const t = normalizeNote(body);
  if (!t) return /^[\p{Extended_Pictographic}\s]+$/u.test(body.trim());
  return TRIVIAL_RE.test(t);
}

// ---------------------------------------------------------------------------
// Validación de la salida
// ---------------------------------------------------------------------------

export type ValidatedNotes = {
  notes: { kind: NoteKind; text: string; dedupeKey: string }[];
  summary: string;
  summaryChanged: boolean;
  counters: Counter[];
  /** Qué se descartó y por qué (solo para el registro). */
  dropped: string[];
};

/** Recorta en el último espacio antes del límite. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Funde contadores: lo nuevo no baja un conteo anterior ni borra uno que no se mencionó. */
export function mergeCounters(previous: Counter[], next: Counter[]): Counter[] {
  const map = new Map<string, Counter>();
  for (const c of previous) {
    const item = c.item.trim().slice(0, COUNTER_ITEM_MAX);
    if (item) map.set(normalizeNote(item), { item, count: Math.max(1, Math.round(c.count)) });
  }
  for (const c of next) {
    const item = redactSensitive(c.item.trim()).slice(0, COUNTER_ITEM_MAX);
    const key = normalizeNote(item);
    if (!key || item.includes(SENSITIVE_PLACEHOLDER)) continue;
    const count = Math.min(Math.max(Math.round(c.count), 1), 999);
    const prev = map.get(key);
    map.set(key, { item: prev?.item ?? item, count: Math.max(prev?.count ?? 0, count) });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, MAX_COUNTERS);
}

/** Medida escrita como «15x20x40» o «12 x 20». */
const MEASURE_RE = /\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?(?:\s*x\s*\d+(?:[.,]\d+)?)?/i;

/**
 * Todo lo de una misma medida va en UNA nota: si el modelo escribió varias notas
 * de producto sobre la misma medida (consulta, precio, cantidad), se juntan.
 */
export function mergeSameProduct(notes: NotesPlan["notes"]): NotesPlan["notes"] {
  const result: NotesPlan["notes"] = [];
  const byMeasure = new Map<string, number>();
  for (const note of notes) {
    const measure = note.kind === "producto" ? note.text.match(MEASURE_RE)?.[0].replace(/\s+/g, "").toLowerCase() : undefined;
    const index = measure ? byMeasure.get(measure) : undefined;
    if (index === undefined) {
      if (measure) byMeasure.set(measure, result.length);
      result.push({ ...note });
      continue;
    }
    const current = result[index];
    const piece = note.text.trim().replace(/[.;\s]+$/, "");
    if (!normalizeNote(current.text).includes(normalizeNote(piece))) {
      current.text = `${current.text.trim().replace(/[.;\s]+$/, "")}; ${piece.charAt(0).toLowerCase()}${piece.slice(1)}.`;
    }
  }
  return result;
}

/**
 * Aplica las reglas del servidor a la salida del modelo:
 *  - las notas de producto de una misma medida se juntan en una;
 *  - máximo 3 notas, de las categorías que el cliente habilitó;
 *  - sin datos sensibles (si solo quedaba el dato, la nota se descarta);
 *  - sin repetir notas anteriores del agente ni entre sí;
 *  - resumen recortado al límite del proveedor, también sin datos sensibles;
 *  - contadores fundidos con los anteriores.
 */
export function validateNotesPlan(
  plan: NotesPlan,
  input: {
    capture: Record<NotesCaptureKey, boolean>;
    previousNotes: string[];
    previousSummary: string;
    previousCounters: Counter[];
    summaryMaxChars: number;
  },
): ValidatedNotes {
  const dropped: string[] = [];
  const accepted: ValidatedNotes["notes"] = [];
  for (const note of mergeSameProduct(plan.notes)) {
    const capture = KIND_TO_CAPTURE[note.kind];
    if (capture && !input.capture[capture]) {
      dropped.push(`categoría apagada (${note.kind})`);
      continue;
    }
    const text = clip(redactSensitive(note.text.replace(/\s+/g, " ").trim()), NOTE_MAX_CHARS);
    const meaningful = normalizeNote(text.replaceAll(SENSITIVE_PLACEHOLDER, ""));
    if (meaningful.length < 4) {
      dropped.push("vacía o solo dato sensible");
      continue;
    }
    if (isNearDuplicate(text, [...input.previousNotes, ...accepted.map((n) => n.text)])) {
      dropped.push("repetida");
      continue;
    }
    if (accepted.length >= MAX_NOTES_PER_RUN) {
      dropped.push("más de 3");
      continue;
    }
    accepted.push({ kind: note.kind, text, dedupeKey: normalizeNote(text) });
  }

  let summary = clip(redactSensitive(plan.summary.trim()), input.summaryMaxChars);
  let summaryChanged = plan.summaryChanged && summary !== "" && summary !== input.previousSummary.trim();
  // Un resumen vacío nunca borra el anterior.
  if (!summary) {
    summary = input.previousSummary;
    summaryChanged = false;
  }

  return {
    notes: accepted,
    summary,
    summaryChanged,
    counters: mergeCounters(input.previousCounters, plan.counters),
    dropped,
  };
}

/** Frases del resumen escrito por una persona que ya no aparecen (casi nada de sus palabras) en el nuevo. */
export function missingSentences(humanSummary: string, newSummary: string): string[] {
  return humanSummary
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => normalizeNote(s).split(" ").filter((w) => w.length > 2).length >= 2)
    .filter((s) => containment(s, newSummary) < 0.5);
}

/** Aviso del reintento cuando el modelo quitó frases que escribió una persona. */
export function keepHumanSummaryNotice(missing: string[]): string {
  return [
    "Tu resumen quitó estas frases que escribió una persona del equipo:",
    ...missing.map((m) => `- ${m}`),
    "Vuelve a llamar a «registrar_notas» conservándolas (puedes acortarlas) salvo que el cliente las haya corregido explícitamente en los mensajes nuevos. Las notas pueden quedar igual.",
  ].join("\n");
}

/** Contadores guardados (jsonb) → lista válida. */
export function parseCounters(raw: unknown): Counter[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c) => {
    if (!c || typeof c !== "object") return [];
    const { item, count } = c as Record<string, unknown>;
    return typeof item === "string" && typeof count === "number" ? [{ item, count }] : [];
  });
}
