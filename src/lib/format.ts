const timeFormat = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
});
const shortDateFormat = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});
const weekdayFormat = new Intl.DateTimeFormat("es", { weekday: "long" });
const longDateFormat = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Diferencia en días de calendario (0 = hoy, 1 = ayer…). */
function daysAgo(date: Date, now: number): number {
  return Math.round((startOfDay(new Date(now)) - startOfDay(date)) / DAY_MS);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Para la lista: hora si es de hoy, "Ayer", día de la semana o fecha corta. */
export function formatListTime(iso: string | null, now: number): string {
  if (!iso) return "";
  const date = new Date(iso);
  const days = daysAgo(date, now);
  if (days === 0) return timeFormat.format(date);
  if (days === 1) return "Ayer";
  if (days < 7) return capitalize(weekdayFormat.format(date));
  return shortDateFormat.format(date);
}

/** Separador de fecha en el chat: "Hoy", "Ayer" o "Lunes, 12 de octubre de 2026". */
export function formatDayLabel(iso: string, now: number): string {
  const date = new Date(iso);
  const days = daysAgo(date, now);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return capitalize(longDateFormat.format(date));
}

/** Clave del día local (para agrupar mensajes por fecha). */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return shortDateFormat.format(new Date(iso));
}

const relativeFormat = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** "hace 3 días", "ayer", "hace 2 h"… para la última interacción. */
export function formatRelative(iso: string | null | undefined, now: number): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - now;
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormat.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeFormat.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return relativeFormat.format(months, "month");
  return relativeFormat.format(Math.round(days / 365), "year");
}

/** "5 h 12 min" a partir de milisegundos. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

/** "18 h restantes" / "35 min restantes" para la píldora de la ventana de 24 h. */
export function formatRemaining(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes >= 60) return `${Math.floor(minutes / 60)} h restantes`;
  return minutes <= 1 ? "menos de 1 min" : `${minutes} min restantes`;
}

/**
 * Teléfono legible SOLO para mostrar (no cambia lo guardado en phone ni wa_id).
 * México (10 dígitos, 52 o 521 + 10): "+52 644 407 5142". Cualquier otro: "+" + número.
 * Mismo criterio que public.normalize_phone en la base.
 */
export function formatPhone(waId: string | null | undefined): string {
  if (!waId) return "Sin teléfono";
  const digits = waId.replace(/\D/g, "");
  if (!digits) return waId;
  const mx = /^(?:521?)?(\d{3})(\d{3})(\d{4})$/.exec(digits);
  if (mx) return `+52 ${mx[1]} ${mx[2]} ${mx[3]}`;
  return `+${digits}`;
}
