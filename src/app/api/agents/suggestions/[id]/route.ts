import { NextResponse, type NextRequest } from "next/server";
import { AgentSendError, MAX_AGENT_TEXT, sendAgentText } from "@/lib/agents/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { WhatsAppApiError } from "@/lib/whatsapp/send";

type Body = { action?: unknown; text?: unknown };

/**
 * Resuelve una sugerencia del asistente desde el chat:
 *  - send: la envía tal cual (o con `text` si el operador la editó);
 *  - discard: la descarta.
 * El mensaje enviado lleva la etiqueta «Asistente» y la persona que lo aprobó.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/agents/suggestions/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const action = body.action === "send" || body.action === "discard" ? body.action : null;
  if (!action || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Petición no válida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: suggestion } = await admin
    .from("agent_suggestions")
    .select("id, body, agent_id, conversation_id, status")
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

  const edited = typeof body.text === "string" ? body.text.trim() : "";
  const text = edited || suggestion.body;
  if (text.length > MAX_AGENT_TEXT) {
    return NextResponse.json({ error: `El mensaje supera ${MAX_AGENT_TEXT} caracteres` }, { status: 400 });
  }

  // Se «reserva» la sugerencia antes de enviar: dos clics no la mandan dos veces.
  const { data: claimed } = await admin
    .from("agent_suggestions")
    .update({ status: edited && edited !== suggestion.body ? "edited" : "sent", resolved_by: user.id, resolved_at: resolvedAt })
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

  try {
    const { messageId } = await sendAgentText(admin, {
      conversationId: suggestion.conversation_id,
      waId: conversation?.contacts?.wa_id ?? null,
      lastInboundAt: conversation?.last_inbound_at ?? null,
      text,
      agentId: suggestion.agent_id,
      senderId: user.id,
    });
    return NextResponse.json({ ok: true, messageId });
  } catch (error) {
    // Si no salió, la sugerencia vuelve a quedar pendiente para reintentar.
    const notSent = !(error instanceof AgentSendError && error.code === "SAVE_FAILED");
    if (notSent) {
      await admin
        .from("agent_suggestions")
        .update({ status: "pending", resolved_by: null, resolved_at: null })
        .eq("id", id);
    }
    if (error instanceof AgentSendError) {
      const status = error.code === "SAVE_FAILED" ? 500 : 422;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    if (error instanceof WhatsAppApiError) {
      console.error(`[agents-suggestion] Meta rechazó el envío (código ${error.code ?? "?"})`);
      return NextResponse.json({ error: `WhatsApp rechazó el mensaje: ${error.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: "No se pudo contactar a WhatsApp" }, { status: 502 });
  }
}
