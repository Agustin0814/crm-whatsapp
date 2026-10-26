import "server-only";
import { isWindowOpen } from "@/lib/conversation-window";
import type { createAdminClient } from "@/lib/supabase/admin";
import { sendTextMessage } from "@/lib/whatsapp/send";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Límite de caracteres de un mensaje de texto en WhatsApp. */
export const MAX_AGENT_TEXT = 4096;

export class AgentSendError extends Error {
  constructor(
    message: string,
    readonly code: "WINDOW_CLOSED" | "NO_WA_ID" | "EMPTY" | "SAVE_FAILED",
  ) {
    super(message);
    this.name = "AgentSendError";
  }
}

/**
 * Envía un texto del asistente por el flujo normal de WhatsApp (misma función
 * que la bandeja: toSendableNumber, ventana de 24 h) y lo guarda con
 * sent_by_agent = true. El trigger de la base actualiza la conversación y el
 * contador de respuestas seguidas. Solo con el cliente admin: un usuario no
 * puede marcar mensajes como del asistente (trigger protect_agent_message_fields).
 *
 * `senderId`: la persona que aprobó una sugerencia (null si fue automático).
 */
export async function sendAgentText(
  supabase: AdminClient,
  input: {
    conversationId: string;
    waId: string | null;
    lastInboundAt: string | null;
    text: string;
    agentId: string;
    senderId: string | null;
  },
): Promise<{ messageId: string }> {
  const text = input.text.trim().slice(0, MAX_AGENT_TEXT);
  if (!text) throw new AgentSendError("Mensaje vacío", "EMPTY");
  if (!isWindowOpen(input.lastInboundAt)) {
    throw new AgentSendError("La ventana de 24 h está cerrada", "WINDOW_CLOSED");
  }
  if (!input.waId) throw new AgentSendError("El contacto no tiene WhatsApp", "NO_WA_ID");

  // Lanza WhatsAppApiError si Meta lo rechaza.
  const waMessageId = await sendTextMessage(input.waId, text);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      direction: "outbound",
      status: "sending",
      type: "text",
      body: text,
      sender_id: input.senderId,
      wa_message_id: waMessageId,
      sent_by_agent: true,
      agent_id: input.agentId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(`[agents] Mensaje ${waMessageId} enviado pero no guardado`);
    throw new AgentSendError("El mensaje se envió pero no se pudo guardar", "SAVE_FAILED");
  }
  return { messageId: data.id };
}
