// Capa EDITABLE por el cliente de un agente (columna agents.config) y sus
// límites. Se usa en la interfaz (formulario) y en el servidor (el motor
// vuelve a recortar todo al leer). Aquí no hay secretos ni la capa bloqueada.

import type { Classification } from "@/lib/crm/types";

export const AGENT_KEYS = { responder: "responder" } as const;

/** Descripción del encabezado de /agentes (la comparte el esqueleto de carga). */
export const AGENTS_DESCRIPTION = "Asistentes de IA que te ayudan a responder en el chat.";

export type AgentMode = "suggestion" | "automatic";

export const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  suggestion: "Sugerencia",
  automatic: "Automático",
};

export type ScheduleMode = "always" | "after_hours" | "custom";

export const SCHEDULE_MODE_LABELS: Record<ScheduleMode, string> = {
  always: "Siempre",
  after_hours: "Fuera de horario",
  custom: "Horario personalizado",
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

export type AgentConfig = {
  business_info: string;
  tone: {
    style: "formal" | "cercano";
    pronoun: "tu" | "usted";
    emojis: "ninguno" | "pocos" | "libres";
    length: "corta" | "media";
  };
  /** Días ISO (1 = lunes … 7 = domingo) y horas «HH:MM» en America/Hermosillo. */
  schedule: { mode: ScheduleMode; days: number[]; start: string; end: string };
  delay_minutes: number;
  scope: { classifications: Classification[]; excluded_tag_ids: string[] };
  limits: { max_consecutive: number; daily_cap: number };
  escalation: { topics: string[]; handoff_message: string; assign_to: string | null };
  extra_instructions: string;
  alerts: { on_handoff: boolean; on_daily_cap: boolean; on_error: boolean };
};

/** Rangos permitidos (los devuelve `agent_limits` desde la capa bloqueada). */
export type AgentLimits = {
  max_consecutive_min: number;
  max_consecutive_max: number;
  daily_cap_min: number;
  daily_cap_max: number;
  delay_minutes_min: number;
  delay_minutes_max: number;
  extra_instructions_max: number;
  business_info_max: number;
  monthly_token_cap: number;
  kill_switch: boolean;
};

export const DEFAULT_LIMITS: AgentLimits = {
  max_consecutive_min: 1,
  max_consecutive_max: 10,
  daily_cap_min: 1,
  daily_cap_max: 200,
  delay_minutes_min: 0,
  delay_minutes_max: 10,
  extra_instructions_max: 1000,
  business_info_max: 4000,
  monthly_token_cap: 0,
  kill_switch: false,
};

export const DEFAULT_HANDOFF_MESSAGE = "Gracias por tu paciencia. Te comunico con un asesor que te atenderá en breve.";

export const DEFAULT_CONFIG: AgentConfig = {
  business_info: "",
  tone: { style: "cercano", pronoun: "tu", emojis: "pocos", length: "corta" },
  schedule: { mode: "always", days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" },
  delay_minutes: 2,
  scope: { classifications: ["unclassified", "prospect"], excluded_tag_ids: [] },
  limits: { max_consecutive: 5, daily_cap: 100 },
  escalation: { topics: [], handoff_message: DEFAULT_HANDOFF_MESSAGE, assign_to: null },
  extra_instructions: "",
  alerts: { on_handoff: true, on_daily_cap: true, on_error: true },
};

const CLASSIFICATION_VALUES: Classification[] = ["unclassified", "prospect", "customer", "supplier"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.min(Math.max(fallback, min), max);
  return Math.min(Math.max(Math.round(n), min), max);
}

function str(value: unknown, max: number, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function pick<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
  const esc = obj(c.escalation);
  const alerts = obj(c.alerts);
  const d = DEFAULT_CONFIG;

  const days = Array.isArray(schedule.days)
    ? [...new Set(schedule.days.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort()
    : d.schedule.days;
  const classifications = Array.isArray(scope.classifications)
    ? scope.classifications.filter((v): v is Classification => CLASSIFICATION_VALUES.includes(v as Classification))
    : d.scope.classifications;

  return {
    business_info: str(c.business_info, limits.business_info_max),
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
    delay_minutes: clampInt(c.delay_minutes, limits.delay_minutes_min, limits.delay_minutes_max, d.delay_minutes),
    scope: {
      classifications,
      excluded_tag_ids: Array.isArray(scope.excluded_tag_ids)
        ? scope.excluded_tag_ids.filter((v): v is string => typeof v === "string")
        : [],
    },
    limits: {
      max_consecutive: clampInt(lim.max_consecutive, limits.max_consecutive_min, limits.max_consecutive_max, d.limits.max_consecutive),
      daily_cap: clampInt(lim.daily_cap, limits.daily_cap_min, limits.daily_cap_max, d.limits.daily_cap),
    },
    escalation: {
      topics: Array.isArray(esc.topics)
        ? esc.topics.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim().slice(0, 80)).slice(0, 30)
        : [],
      handoff_message: str(esc.handoff_message, 500).trim() || DEFAULT_HANDOFF_MESSAGE,
      assign_to: typeof esc.assign_to === "string" && esc.assign_to ? esc.assign_to : null,
    },
    extra_instructions: str(c.extra_instructions, limits.extra_instructions_max),
    alerts: {
      on_handoff: alerts.on_handoff !== false,
      on_daily_cap: alerts.on_daily_cap !== false,
      on_error: alerts.on_error !== false,
    },
  };
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
};
