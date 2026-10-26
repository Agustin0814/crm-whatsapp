import { NextResponse, type NextRequest } from "next/server";
import { isValidCronRequest } from "@/lib/agents/cron-auth";
import { processDueRuns } from "@/lib/agents/engine";
import { createAdminClient } from "@/lib/supabase/admin";

// Cada corrida puede llamar al modelo y a WhatsApp.
export const maxDuration = 60;

/**
 * Procesa las respuestas programadas de los agentes. Lo llama pg_cron (pg_net)
 * cada minuto, solo cuando hay corridas vencidas, con el secreto CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  if (!isValidCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await processDueRuns(createAdminClient());
    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "desconocido";
    console.error(`[agents-run] ${detail}`);
    return NextResponse.json({ error: "No se pudieron procesar las corridas" }, { status: 500 });
  }
}
