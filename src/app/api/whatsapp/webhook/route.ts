import { after, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { processWebhookPayload } from "@/lib/whatsapp/process-webhook";
import { isValidSignature } from "@/lib/whatsapp/signature";
import type { WaWebhookPayload } from "@/lib/whatsapp/types";

// Tiempo máximo para terminar el procesamiento en segundo plano (Vercel).
export const maxDuration = 60;

/** Verificación del webhook al registrarlo en Meta. */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (
    mode === "subscribe" &&
    challenge &&
    token === serverEnv("WHATSAPP_VERIFY_TOKEN")
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Eventos de mensajes y estados. Responde 200 rápido y procesa después. */
export async function POST(request: NextRequest) {
  // La firma se calcula sobre el body crudo, antes de parsear el JSON.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!isValidSignature(rawBody, signature, serverEnv("WHATSAPP_APP_SECRET"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: WaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WaWebhookPayload;
  } catch {
    // Firma válida pero JSON roto: no tiene sentido que Meta reintente.
    return new Response("OK", { status: 200 });
  }

  const phoneNumberId = serverEnv("WHATSAPP_PHONE_NUMBER_ID");

  // after() corre cuando la respuesta ya se envió (en Vercel usa waitUntil).
  after(async () => {
    try {
      await processWebhookPayload(payload, phoneNumberId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "desconocido";
      console.error(`[whatsapp-webhook] Error inesperado: ${detail}`);
    }
  });

  return new Response("OK", { status: 200 });
}
