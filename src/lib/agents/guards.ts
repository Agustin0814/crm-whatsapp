import type { AgentConfig } from "./config";

// Reglas puras (sin base ni red) que el motor evalúa antes de responder.
// Se dejan aparte para reutilizarlas en otros agentes y en el futuro probador.

export const AGENT_TIME_ZONE = "America/Hermosillo";

/** Día ISO (1 = lunes … 7 = domingo) y minutos del día en la zona del negocio. */
export function localDayAndMinutes(now: Date = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AGENT_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const days: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { day: days[get("weekday")] ?? 1, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** true si `now` cae dentro del horario de atención configurado. */
export function isWithinBusinessHours(schedule: AgentConfig["schedule"], now: Date = new Date()): boolean {
  const { day, minutes } = localDayAndMinutes(now);
  if (!schedule.days.includes(day)) return false;
  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);
  // Horario que cruza la medianoche (p. ej. 20:00–02:00).
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/**
 * ¿Puede actuar el agente a esta hora?
 *  - always: siempre;
 *  - after_hours: solo FUERA del horario de atención (cuando no hay personas);
 *  - custom: solo DENTRO del horario configurado.
 */
export function isScheduleActive(schedule: AgentConfig["schedule"], now: Date = new Date()): boolean {
  if (schedule.mode === "always") return true;
  const inside = isWithinBusinessHours(schedule, now);
  return schedule.mode === "after_hours" ? !inside : inside;
}

/** Texto sin acentos ni mayúsculas (igual que private.fold_text). */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Primer tema de escalamiento que aparece al inicio de palabra en el texto. */
export function matchEscalationTopic(text: string, topics: string[]): string | null {
  const folded = foldText(text);
  for (const topic of topics) {
    const t = foldText(topic.trim());
    if (!t) continue;
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}`, "u").test(folded)) return topic;
  }
  return null;
}

/** ¿El contacto está dentro del alcance (clasificación y etiquetas excluidas)? */
export function scopeBlockReason(
  scope: AgentConfig["scope"],
  contact: { classification: string | null; tagIds: string[] },
): string | null {
  const classification = contact.classification ?? "unclassified";
  if (!scope.classifications.includes(classification as AgentConfig["scope"]["classifications"][number])) {
    return `Fuera de alcance (clasificación ${classification})`;
  }
  if (contact.tagIds.some((id) => scope.excluded_tag_ids.includes(id))) {
    return "Fuera de alcance (etiqueta excluida)";
  }
  return null;
}

/** Costo estimado en USD con los precios por millón de la capa bloqueada. */
export function estimateCostUsd(
  usage: { inputTokens: number; outputTokens: number },
  prices: { input_price_per_mtok: number; output_price_per_mtok: number },
): number {
  const cost = (usage.inputTokens * prices.input_price_per_mtok + usage.outputTokens * prices.output_price_per_mtok) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
