import { NextResponse, type NextRequest } from "next/server";
import { askAssistant, type ChatMode } from "@/lib/agents/system-engine";
import { createClient } from "@/lib/supabase/server";

// El modelo puede hacer varias consultas antes de responder.
export const maxDuration = 60;

type Body = {
  question?: unknown;
  /** { mode: "temp", history: string[] } | { mode: "saved", id } | { mode: "new", title? } */
  chat?: unknown;
  /** Conversación abierta en pantalla (el servidor comprueba el acceso). */
  screenConversationId?: unknown;
};

function parseChat(raw: unknown): ChatMode | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (c.mode === "temp") return { mode: "temp", history: Array.isArray(c.history) ? c.history : [] };
  if (c.mode === "saved" && typeof c.id === "string") return { mode: "saved", id: c.id };
  if (c.mode === "new") return { mode: "new", title: typeof c.title === "string" ? c.title : null };
  return null;
}

/**
 * Una pregunta al Asistente del sistema. Sesión del usuario obligatoria; el
 * motor revalida rol, límites y acceso a cada dato en el servidor.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const chat = parseChat(body.chat);
  if (typeof body.question !== "string" || !chat) return NextResponse.json({ error: "Petición no válida" }, { status: 400 });

  const supabase = await createClient();
  const result = await askAssistant(supabase, { question: body.question, chat, screenConversationId: body.screenConversationId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    turn: result.turn,
    token: result.token,
    chatId: result.chatId,
    requests: result.requests,
    questions: result.questions,
  });
}
