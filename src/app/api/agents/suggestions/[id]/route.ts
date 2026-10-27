import { NextResponse, type NextRequest } from "next/server";
import { PART_PAUSE_MS, sleep } from "@/lib/agents/engine";
import { MAX_ACTIONS_PER_RUN } from "@/lib/agents/prompt";
import { AgentSendError, MAX_AGENT_TEXT, sendAgentText } from "@/lib/agents/send";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { WhatsAppApiError } from "@/lib/whatsapp/send";

type Body = { action?: unknown; text?: unknown; texts?: unknown[] };

/** Máximo de mensajes de una sugerencia (igual que las acciones por corrida). */
const MAX_PARTS = MAX_ACTIONS_PER_RUN;

/**
 * Resuelve una sugerencia del asistente desde el chat:
 *  - send: envía sus partes en orden, tal cual o editadas (`texts`, una por parte);
 *  - discard: la descarta.
 * Los mensajes llevan el nombre del asistente y la persona que los aprobó.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/agents/suggestions/[id]">) {
  const { id } = await ctx.params;
  // Vendedor o administración ACTIVOS: después se usa la service role, así que
  // el rol se valida aquí (el repartidor no ve ni aprueba sugerencias).
  const check = await requireRole(["vendedor", "admin", "superadmin"]);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const user = { id: check.userId };

  const body = (await request.json().catch(() => ({}))) as Body;
  const action = body.action === "send" || body.action === "discard" ? body.action : null;
  if (!action || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Petición no válida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: suggestion } = await admin
    .from("agent_suggestions")
    .select("id, body, parts, agent_id, conversation_id, status, seen_inbound_at, run_id")
    .eq("id", id)
    .maybeSingle();
  if (!suggestion) return NextResponse.json({ error: "Sugerencia no encontrada" }, { status: 404 });
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "Esta sugerencia ya no está disponible" }, { status: 409 });
  }

  const resolvedAt = new Date().toISOString();

  if (action === "discard") {
    await admin
      .from("agent_suggestions")
      .update({ status: "discarded", resolved_by: user.id, resolved_at: resolvedAt })
      .eq("id", id)
      .eq("status", "pending");
    return NextResponse.json({ ok: true });
  }

  // Partes de la sugerencia (hasta 3 mensajes). Las antiguas solo tienen `body`.
  const stored = Array.isArray(suggestion.parts)
    ? suggestion.parts
        .map((p) => (p && typeof p === "object" && "text" in p && typeof p.text === "string" ? p.text : ""))
        .filter(Boolean)
    : [];
  const original = stored.length ? stored : [suggestion.body];
  // Edición: `texts` (una por parte) o `text` (una sola). Las partes vacías se omiten.
  const editedTexts = Array.isArray(body.texts)
    ? body.texts.map((t) => (typeof t === "string" ? t.trim() : ""))
    : typeof body.text === "string"
      ? [body.text.trim()]
      : null;
  const texts = (editedTexts ?? original).filter(Boolean).slice(0, MAX_PARTS);
  if (!texts.length) return NextResponse.json({ error: "El mensaje está vacío" }, { status: 400 });
  if (texts.some((t) => t.length > MAX_AGENT_TEXT)) {
    return NextResponse.json({ error: `Un mensaje supera ${MAX_AGENT_TEXT} caracteres` }, { status: 400 });
  }
  const edited = editedTexts !== null && texts.join("\n\n") !== original.join("\n\n");

  // Se «reserva» la sugerencia antes de enviar: dos clics no la mandan dos veces.
  const { data: claimed } = await admin
    .from("agent_suggestions")
    .update({ status: edited ? "edited" : "sent", resolved_by: user.id, resolved_at: resolvedAt })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) {
    return NextResponse.json({ error: "Esta sugerencia ya no está disponible" }, { status: 409 });
  }

  const { data: conversation } = await admin
    .from("conversations")
    .select("id, last_inbound_at, contacts(wa_id)")
    .eq("id", suggestion.conversation_id)
    .maybeSingle();

  // Cada parte sale en orden con una pausa breve; todas llevan la misma corrida
  // (cuentan como UNA respuesta seguida) y lo que vio el modelo al generar.
  let sent = 0;
  try {
    for (const text of texts) {
      if (sent > 0) await sleep(PART_PAUSE_MS);
      await sendAgentText(admin, {
        conversationId: suggestion.conversation_id,
        waId: conversation?.contacts?.wa_id ?? null,
        lastInboundAt: conversation?.last_inbound_at ?? null,
        text,
        agentId: suggestion.agent_id,
        senderId: user.id,
        answeredThrough: suggestion.seen_inbound_at,
        runId: suggestion.run_id,
      });
      sent += 1;
    }
    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    // Si no salió NINGUNA parte, la sugerencia vuelve a quedar pendiente para reintentar.
    // Si ya salió alguna, no se reintenta (se duplicarían mensajes).
    const nothingSent = sent === 0 && !(error instanceof AgentSendError && error.code === "SAVE_FAILED");
    if (nothingSent) {
      await admin
        .from("agent_suggestions")
        .update({ status: "pending", resolved_by: null, resolved_at: null })
        .eq("id", id);
    }
    const partial = sent > 0 ? ` (se enviaron ${sent} de ${texts.length})` : "";
    if (error instanceof AgentSendError) {
      const status = error.code === "SAVE_FAILED" ? 500 : 422;
      return NextResponse.json({ error: `${error.message}${partial}`, code: error.code }, { status });
    }
    if (error instanceof WhatsAppApiError) {
      console.error(`[agents-suggestion] Meta rechazó el envío (código ${error.code ?? "?"})`);
      return NextResponse.json({ error: `WhatsApp rechazó el mensaje: ${error.message}${partial}` }, { status: 502 });
    }
    return NextResponse.json({ error: `No se pudo contactar a WhatsApp${partial}` }, { status: 502 });
  }
}
