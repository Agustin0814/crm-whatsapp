// Capa del CLIENTE de un agente (columna agents.config) y sus límites. Se usa
// en la interfaz (panel) y en el servidor (el motor vuelve a recortar todo al
// leer). Aquí no hay secretos ni nada de la capa del proveedor.

import type { Classification } from "@/lib/crm/types";

export const AGENT_KEYS = { responder: "responder", notes: "notes" } as const;

/** Tipo de agente (agents.kind): decide su motor, su panel y si tiene modo. */
export type AgentKind = "responder" | "notes";

/**
 * Descripción corta de cada agente en la lista de /agentes, por `agents.key`.
 * Un agente nuevo sin entrada aquí usa la genérica.
 */
export const AGENT_DESCRIPTIONS: Record<string, string> = {
  responder: "Responde mensajes de WhatsApp en el chat y puede usar tus respuestas rápidas.",
  notes: "Deja notas internas y un resumen del cliente. Nunca escribe al cliente.",
};
export const DEFAULT_AGENT_DESCRIPTION = "Asistente de IA del chat.";

export type AgentMode = "suggestion" | "automatic";

export const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  suggestion: "Sugerencia",
  automatic: "Automático",
};

export type ScheduleMode = "always" | "after_hours" | "custom";

export const SCHEDULE_MODE_LABELS: Record<ScheduleMode, string> = {
  always: "Siempre",
  after_hours: "Solo fuera de mi horario",
  custom: "Personalizado",
};

export type QuickReplyPermission = "automatic" | "approval" | "human_only";

export const QUICK_REPLY_PERMISSION_LABELS: Record<QuickReplyPermission, string> = {
  automatic: "Automática",
  approval: "Con aprobación",
  human_only: "Solo humano",
};

export function isQuickReplyPermission(value: string | null | undefined): value is QuickReplyPermission {
  return value === "automatic" || value === "approval" || value === "human_only";
}

/** Nombre por defecto del asistente (etiqueta de sus mensajes). */
export const DEFAULT_DISPLAY_NAME = "Asistente";
export const DISPLAY_NAME_MAX = 40;

/**
 * Capa del CLIENTE (agents.config). Sin texto libre para el modelo: el motor
 * traduce cada opción a una instrucción fija escrita por el proveedor.
 * Lo del proveedor (negocio, escalamiento, traspaso, modelo, techos) vive en
 * agent_locked_config y nunca pasa por aquí.
 */
export type AgentConfig = {
  display_name: string;
  tone: {
    style: "formal" | "cercano";
    pronoun: "tu" | "usted";
    /** «libres» se muestra como «Varios». */
    emojis: "ninguno" | "pocos" | "libres";
    length: "corta" | "media";
  };
  /** Días ISO (1 = lunes … 7 = domingo) y horas «HH:MM» en America/Hermosillo. */
  schedule: { mode: ScheduleMode; days: number[]; start: string; end: string };
  /** Espera antes de responder, en segundos (rango del proveedor). */
  delay_seconds: number;
  scope: { classifications: Classification[]; excluded_tag_ids: string[] };
  limits: { max_consecutive: number; daily_cap: number };
  /** Respuestas rápidas que el cliente encendió (las nuevas nacen apagadas). */
  quick_reply_ids: string[];
  alerts: { on_handoff: boolean; on_daily_cap: boolean; on_monthly_threshold: boolean };
};

/** Rangos permitidos (los devuelve `agent_limits` desde la capa del proveedor). */
export type AgentLimits = {
  max_consecutive_min: number;
  max_consecutive_max: number;
  daily_cap_min: number;
  daily_cap_max: number;
  delay_seconds_min: number;
  delay_seconds_max: number;
  monthly_token_cap: number;
  kill_switch: boolean;
};

export const DEFAULT_LIMITS: AgentLimits = {
  max_consecutive_min: 1,
  max_consecutive_max: 10,
  daily_cap_min: 1,
  daily_cap_max: 200,
  delay_seconds_min: 5,
  delay_seconds_max: 600,
  monthly_token_cap: 0,
  kill_switch: false,
};

/** Presets de espera del panel (segundos). */
export const DELAY_PRESETS = [
  { seconds: 15, label: "Rápido", hint: "15 s" },
  { seconds: 30, label: "Normal", hint: "30 s" },
  { seconds: 120, label: "Pausado", hint: "2 min" },
] as const;

export const DEFAULT_CONFIG: AgentConfig = {
  display_name: DEFAULT_DISPLAY_NAME,
  tone: { style: "cercano", pronoun: "tu", emojis: "pocos", length: "corta" },
  schedule: { mode: "always", days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" },
  delay_seconds: 30,
  scope: { classifications: ["unclassified", "prospect"], excluded_tag_ids: [] },
  limits: { max_consecutive: 5, daily_cap: 100 },
  quick_reply_ids: [],
  alerts: { on_handoff: true, on_daily_cap: true, on_monthly_threshold: true },
};

const CLASSIFICATION_VALUES: Classification[] = ["unclassified", "prospect", "customer", "supplier"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.min(Math.max(fallback, min), max);
  return Math.min(Math.max(Math.round(n), min), max);
}

function pick<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === "string" && v !== ""))] : [];
}

/**
 * Convierte el jsonb guardado en una configuración completa y dentro de los
 * límites. Nunca lanza: lo desconocido toma el valor por defecto.
 */
export function parseAgentConfig(raw: unknown, limits: AgentLimits = DEFAULT_LIMITS): AgentConfig {
  const c = obj(raw);
  const tone = obj(c.tone);
  const schedule = obj(c.schedule);
  const scope = obj(c.scope);
  const lim = obj(c.limits);
  const alerts = obj(c.alerts);
  const d = DEFAULT_CONFIG;

  const days = Array.isArray(schedule.days)
    ? [...new Set(schedule.days.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort()
    : d.schedule.days;
  const classifications = Array.isArray(scope.classifications)
    ? scope.classifications.filter((v): v is Classification => CLASSIFICATION_VALUES.includes(v as Classification))
    : d.scope.classifications;
  const name = typeof c.display_name === "string" ? c.display_name.trim().slice(0, DISPLAY_NAME_MAX) : "";

  return {
    display_name: name || DEFAULT_DISPLAY_NAME,
    tone: {
      style: pick(tone.style, ["formal", "cercano"], d.tone.style),
      pronoun: pick(tone.pronoun, ["tu", "usted"], d.tone.pronoun),
      emojis: pick(tone.emojis, ["ninguno", "pocos", "libres"], d.tone.emojis),
      length: pick(tone.length, ["corta", "media"], d.tone.length),
    },
    schedule: {
      mode: pick(schedule.mode, ["always", "after_hours", "custom"], d.schedule.mode),
      days,
      start: typeof schedule.start === "string" && TIME_RE.test(schedule.start) ? schedule.start : d.schedule.start,
      end: typeof schedule.end === "string" && TIME_RE.test(schedule.end) ? schedule.end : d.schedule.end,
    },
    delay_seconds: clampInt(c.delay_seconds, limits.delay_seconds_min, limits.delay_seconds_max, d.delay_seconds),
    scope: { classifications, excluded_tag_ids: strings(scope.excluded_tag_ids) },
    limits: {
      max_consecutive: clampInt(lim.max_consecutive, limits.max_consecutive_min, limits.max_consecutive_max, d.limits.max_consecutive),
      daily_cap: clampInt(lim.daily_cap, limits.daily_cap_min, limits.daily_cap_max, d.limits.daily_cap),
    },
    quick_reply_ids: strings(c.quick_reply_ids),
    alerts: {
      on_handoff: alerts.on_handoff !== false,
      on_daily_cap: alerts.on_daily_cap !== false,
      on_monthly_threshold: alerts.on_monthly_threshold !== false,
    },
  };
}

/**
 * Regla efectiva de una respuesta rápida para el asistente: el proveedor NO la
 * marcó como solo humano Y el cliente la encendió. La usan el motor y el panel.
 */
export function isQuickReplyUsable(
  reply: { id: string; agent_permission: string | null },
  config: Pick<AgentConfig, "quick_reply_ids">,
): boolean {
  return reply.agent_permission !== "human_only" && config.quick_reply_ids.includes(reply.id);
}

/** Espera legible: «15 s», «2 min», «1 min 30 s». */
export function formatDelay(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

/** Motivos de pausa legibles (conversations.agent_paused_reason). */
export const PAUSE_REASON_LABELS: Record<string, string> = {
  manual: "Pausado a mano",
  human_replied: "Respondió una persona",
  assigned: "Conversación asignada",
  handoff: "Transferido a una persona",
  limit_consecutive: "Límite de respuestas seguidas",
};

export const OUTCOME_LABELS: Record<string, string> = {
  sent: "Enviado",
  suggested: "Sugerido",
  skipped: "Omitido",
  handoff: "Transferido",
  error: "Error",
  blocked_by_limit: "Bloqueado por límite",
  noted: "Anotado",
};
