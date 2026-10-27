import { NextResponse, type NextRequest } from "next/server";
import { isWindowOpen } from "@/lib/conversation-window";
import { createClient } from "@/lib/supabase/server";
import { sendTextMessage, WhatsAppApiError } from "@/lib/whatsapp/send";

/** Límite de caracteres de un mensaje de texto en WhatsApp. */
const MAX_TEXT_LENGTH = 4096;

type SendBody = { conversationId?: unknown; text?: unknown; quickReplyIds?: unknown };

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Sesión del usuario (se revalida aquí aunque el proxy ya lo haga).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 2. Validar el body.
  const body = (await request.json().catch(() => ({}))) as SendBody;
  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!conversationId || !text) {
    return NextResponse.json(
      { error: "Faltan conversationId o text" },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `El mensaje supera ${MAX_TEXT_LENGTH} caracteres` },
      { status: 400 },
    );
  }

  // 2b. Respuestas rápidas usadas: deben ser visibles para el rol de quien
  // escribe (RLS de quick_replies según visible_para).
  const quickReplyIds = Array.isArray(body.quickReplyIds)
    ? [...new Set(body.quickReplyIds.filter((id): id is string => typeof id === "string" && UUID_RE.test(id)))].slice(0, 20)
    : [];
  if (quickReplyIds.length > 0) {
    const { data: visible, error: qrError } = await supabase.from("quick_replies").select("id").in("id", quickReplyIds);
    if (qrError) return NextResponse.json({ error: "No se pudieron validar las respuestas rápidas" }, { status: 500 });
    if ((visible?.length ?? 0) !== quickReplyIds.length) {
      return NextResponse.json({ error: "Una de las respuestas rápidas no está disponible para tu rol" }, { status: 403 });
    }
  }

  // 3. Conversación + número del contacto.
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, last_inbound_at, contacts(wa_id)")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError) {
    return NextResponse.json({ error: "Error al leer la conversación" }, { status: 500 });
  }
  if (!conversation?.contacts) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  // 4. Ventana de 24 h: fuera de ella solo se permiten plantillas aprobadas.
  if (!isWindowOpen(conversation.last_inbound_at)) {
    return NextResponse.json(
      {
        error:
          "La ventana de 24 h está cerrada. Solo puedes enviar una plantilla aprobada.",
        code: "WINDOW_CLOSED",
      },
      { status: 422 },
    );
  }

  // 5. Enviar con la Cloud API (un contacto creado a mano puede no tener WhatsApp).
  const waId = conversation.contacts.wa_id;
  if (!waId) {
    return NextResponse.json(
      { error: "Este contacto no tiene un número de WhatsApp vinculado" },
      { status: 422 },
    );
  }
  let waMessageId: string;
  try {
    waMessageId = await sendTextMessage(waId, text);
  } catch (error) {
    if (error instanceof WhatsAppApiError) {
      console.error(`[whatsapp-send] Meta rechazó el envío (código ${error.code ?? "?"})`);
      return NextResponse.json(
        { error: `WhatsApp rechazó el mensaje: ${error.message}` },
        { status: 502 },
      );
    }
    console.error("[whatsapp-send] No se pudo contactar a la Cloud API");
    return NextResponse.json({ error: "No se pudo contactar a WhatsApp" }, { status: 502 });
  }

  // 6. Guardar el mensaje. El trigger actualiza la conversación.
  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      direction: "outbound",
      status: "sending",
      type: "text",
      body: text,
      sender_id: user.id,
      wa_message_id: waMessageId,
    })
    .select("*")
    .single();

  if (insertError) {
    // El mensaje sí salió hacia WhatsApp; solo falló el guardado.
    console.error(`[whatsapp-send] Mensaje ${waMessageId} enviado pero no guardado: ${insertError.message}`);
    return NextResponse.json(
      { error: "El mensaje se envió pero no se pudo guardar" },
      { status: 500 },
    );
  }

  return NextResponse.json({ message });
}
