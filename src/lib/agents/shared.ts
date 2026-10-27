import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_TIME_ZONE } from "./guards";

// Utilidades del servidor que comparten los motores de todos los agentes.

export type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Inicio del día y del mes en America/Hermosillo. Sonora no tiene horario de
 * verano (UTC−7 todo el año), así que el desfase es fijo.
 */
export function periodStarts(now: Date = new Date()): { day: string; month: string; monthDate: string } {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: AGENT_TIME_ZONE }).format(now); // AAAA-MM-DD
  const monthDate = `${local.slice(0, 7)}-01`;
  return {
    day: new Date(`${local}T00:00:00-07:00`).toISOString(),
    month: new Date(`${monthDate}T00:00:00-07:00`).toISOString(),
    monthDate,
  };
}

/** Crea una alerta de este tipo solo si no hay otra desde `since`. */
export async function alertOnce(
  supabase: AdminClient,
  agentId: string,
  kind: "daily_cap" | "token_cap" | "monthly_threshold" | "error",
  audience: "admin" | "superadmin",
  since: string,
  message: string,
): Promise<void> {
  const { count } = await supabase
    .from("agent_alerts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("kind", kind)
    .gte("created_at", since);
  if ((count ?? 0) > 0) return;
  await supabase.from("agent_alerts").insert({ agent_id: agentId, kind, audience, message });
}

export function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) return String((error as { message: unknown }).message);
  return "desconocido";
}
