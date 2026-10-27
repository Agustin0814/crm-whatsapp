import { NextResponse, type NextRequest } from "next/server";
import { saveTempChat } from "@/lib/agents/system-engine";
import { createClient } from "@/lib/supabase/server";

type Body = { title?: unknown; turns?: unknown };

/**
 * Guarda un chat temporal con nombre. Solo acepta turnos firmados por el
 * servidor para este usuario; el rol mínimo del chat se calcula aquí.
 * Renombrar y borrar van directo por RLS (creador o admin).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  if (typeof body.title !== "string" || !Array.isArray(body.turns)) {
    return NextResponse.json({ error: "Petición no válida" }, { status: 400 });
  }
  const supabase = await createClient();
  const result = await saveTempChat(supabase, { title: body.title, turns: body.turns });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ chatId: result.chatId });
}
