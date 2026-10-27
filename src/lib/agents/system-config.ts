// Capa del CLIENTE del Asistente del sistema (agents.config cuando kind = 'system').
// Compartido entre el panel, la burbuja y el motor; la base vuelve a recortar
// todo al guardar (update_agent_settings). Sin secretos ni capa del proveedor.

import { DISPLAY_NAME_MAX } from "./config";

export const DEFAULT_SYSTEM_DISPLAY_NAME = "Asistente";

/** Quién puede usarlo (superadmin siempre puede). */
export type SystemAllowedRoles = "admins" | "admins_and_agents";

export const SYSTEM_ALLOWED_ROLES_LABELS: Record<SystemAllowedRoles, string> = {
  admins: "Solo administradores",
  admins_and_agents: "Administradores y vendedores",
};

export type SystemAgentConfig = {
  display_name: string;
  allowed_roles: SystemAllowedRoles;
  /** Chat temporal (burbuja). */
  temp_chat: boolean;
  /** Chats guardados (sección Asistente). */
  saved_chats: boolean;
  /** Días sin actividad antes de borrar un chat guardado (null = nunca). */
  saved_retention_days: number | null;
  /** Tareas que puede pedir a otros agentes (siempre con confirmación). */
  delegations: { notes_run_now: boolean; responder_pause: boolean };
  limits: { daily_questions_per_person: number };
  alerts: { on_daily_cap: boolean; on_monthly_threshold: boolean };
};

export const RETENTION_MIN_DAYS = 7;
export const RETENTION_MAX_DAYS = 365;

export const DEFAULT_SYSTEM_CONFIG: SystemAgentConfig = {
  display_name: DEFAULT_SYSTEM_DISPLAY_NAME,
  allowed_roles: "admins_and_agents",
  temp_chat: true,
  saved_chats: true,
  saved_retention_days: null,
  delegations: { notes_run_now: true, responder_pause: true },
  limits: { daily_questions_per_person: 30 },
  alerts: { on_daily_cap: true, on_monthly_threshold: true },
};

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.min(Math.max(fallback, min), max);
  return Math.min(Math.max(Math.round(n), min), max);
}

/** Configuración completa y dentro de los límites. Nunca lanza. */
export function parseSystemConfig(raw: unknown, questionsMax = 50): SystemAgentConfig {
  const c = obj(raw);
  const d = DEFAULT_SYSTEM_CONFIG;
  const delegations = obj(c.delegations);
  const alerts = obj(c.alerts);
  const name = typeof c.display_name === "string" ? c.display_name.trim().slice(0, DISPLAY_NAME_MAX) : "";
  const retention = c.saved_retention_days === null || c.saved_retention_days === undefined || c.saved_retention_days === "" ? null : Number(c.saved_retention_days);
  return {
    display_name: name || DEFAULT_SYSTEM_DISPLAY_NAME,
    allowed_roles: c.allowed_roles === "admins" ? "admins" : "admins_and_agents",
    temp_chat: c.temp_chat !== false,
    saved_chats: c.saved_chats !== false,
    saved_retention_days:
      retention === null || !Number.isFinite(retention) ? null : clampInt(retention, RETENTION_MIN_DAYS, RETENTION_MAX_DAYS, 30),
    delegations: {
      notes_run_now: delegations.notes_run_now !== false,
      responder_pause: delegations.responder_pause !== false,
    },
    limits: {
      daily_questions_per_person: clampInt(obj(c.limits).daily_questions_per_person, 1, questionsMax, d.limits.daily_questions_per_person),
    },
    alerts: {
      on_daily_cap: alerts.on_daily_cap !== false,
      on_monthly_threshold: alerts.on_monthly_threshold !== false,
    },
  };
}

/** ¿Este rol puede usar el asistente con esta configuración? */
export function canUseSystemAssistant(config: Pick<SystemAgentConfig, "allowed_roles">, role: string | null | undefined): boolean {
  if (role === "superadmin" || role === "admin") return true;
  return role === "vendedor" && config.allowed_roles === "admins_and_agents";
}

/** Aviso fijo del chat temporal. */
export const TEMP_CHAT_NOTICE = "Este chat no se guarda. El texto se procesa con IA para poder responderte.";
/** Aviso de los chats guardados. */
export const SAVED_CHAT_NOTICE = "Los chats guardados son compartidos con tu equipo.";
