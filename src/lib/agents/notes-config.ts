// Capa del CLIENTE del Asistente de notas (agents.config cuando kind = 'notes').
// Compartido entre el panel y el motor; la base vuelve a recortar todo al guardar
// (update_agent_settings) y el motor al leer. Sin secretos ni capa del proveedor.

import type { Classification } from "@/lib/crm/types";
import { DISPLAY_NAME_MAX } from "./config";

export const DEFAULT_NOTES_DISPLAY_NAME = "Asistente de notas";

/** Qué anota (casillas del panel). */
export type NotesCaptureKey = "delivery" | "products" | "special_requests" | "complaints" | "contact_data";

export const NOTES_CAPTURE_OPTIONS: { key: NotesCaptureKey; label: string; hint: string }[] = [
  { key: "delivery", label: "Datos de entrega", hint: "Dirección, referencias, zona, día y hora." },
  { key: "products", label: "Productos y medidas de interés", hint: "Qué pidió y cuántas veces preguntó." },
  { key: "special_requests", label: "Solicitudes especiales", hint: "Descuento, cotización o factura." },
  { key: "complaints", label: "Quejas o problemas", hint: "Molestias, retrasos o reclamos." },
  { key: "contact_data", label: "Otros datos de contacto", hint: "Otro teléfono, correo o persona que recibe." },
];

export type NotesAgentConfig = {
  display_name: string;
  capture: Record<NotesCaptureKey, boolean>;
  /** Minutos de silencio del cliente antes de anotar, guardados en segundos. */
  delay_seconds: number;
  /** También anotar al pasar el chat a una persona (traspaso del Asistente de respuestas). */
  on_handoff: boolean;
  scope: { classifications: Classification[]; excluded_tag_ids: string[] };
  /** Pasadas por día. */
  limits: { daily_cap: number };
  alerts: { on_daily_cap: boolean; on_monthly_threshold: boolean };
};

/** Rangos del proveedor que necesita el panel (de `agent_limits`). */
export type NotesLimits = {
  daily_cap_max: number;
  delay_seconds_min: number;
  delay_seconds_max: number;
};

export const DEFAULT_NOTES_LIMITS: NotesLimits = { daily_cap_max: 300, delay_seconds_min: 300, delay_seconds_max: 86400 };

/** Presets de silencio del panel (segundos). */
export const SILENCE_PRESETS = [
  { seconds: 600, label: "10 min" },
  { seconds: 900, label: "15 min" },
  { seconds: 1800, label: "30 min" },
  { seconds: 3600, label: "1 h" },
] as const;

export const DEFAULT_NOTES_CONFIG: NotesAgentConfig = {
  display_name: DEFAULT_NOTES_DISPLAY_NAME,
  capture: { delivery: true, products: true, special_requests: true, complaints: true, contact_data: true },
  delay_seconds: 900,
  on_handoff: true,
  scope: { classifications: ["unclassified", "prospect", "customer", "supplier"], excluded_tag_ids: [] },
  limits: { daily_cap: 100 },
  alerts: { on_daily_cap: true, on_monthly_threshold: true },
};

const CLASSIFICATION_VALUES: Classification[] = ["unclassified", "prospect", "customer", "supplier"];

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.min(Math.max(fallback, min), max);
  return Math.min(Math.max(Math.round(n), min), max);
}

/** Configuración completa y dentro de los límites. Nunca lanza. */
export function parseNotesConfig(raw: unknown, limits: NotesLimits = DEFAULT_NOTES_LIMITS): NotesAgentConfig {
  const c = obj(raw);
  const capture = obj(c.capture);
  const scope = obj(c.scope);
  const alerts = obj(c.alerts);
  const d = DEFAULT_NOTES_CONFIG;
  const name = typeof c.display_name === "string" ? c.display_name.trim().slice(0, DISPLAY_NAME_MAX) : "";
  const classifications = Array.isArray(scope.classifications)
    ? [...new Set(scope.classifications.filter((v): v is Classification => CLASSIFICATION_VALUES.includes(v as Classification)))]
    : d.scope.classifications;
  const excluded = Array.isArray(scope.excluded_tag_ids)
    ? [...new Set(scope.excluded_tag_ids.filter((v): v is string => typeof v === "string" && v !== ""))]
    : [];

  return {
    display_name: name || DEFAULT_NOTES_DISPLAY_NAME,
    capture: {
      delivery: capture.delivery !== false,
      products: capture.products !== false,
      special_requests: capture.special_requests !== false,
      complaints: capture.complaints !== false,
      contact_data: capture.contact_data !== false,
    },
    delay_seconds: clampInt(c.delay_seconds, limits.delay_seconds_min, limits.delay_seconds_max, d.delay_seconds),
    on_handoff: c.on_handoff !== false,
    scope: { classifications, excluded_tag_ids: excluded },
    limits: { daily_cap: clampInt(obj(c.limits).daily_cap, 1, limits.daily_cap_max, d.limits.daily_cap) },
    alerts: {
      on_daily_cap: alerts.on_daily_cap !== false,
      on_monthly_threshold: alerts.on_monthly_threshold !== false,
    },
  };
}

/** Silencio legible: «15 min», «1 h», «1 h 30 min». */
export function formatSilence(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
