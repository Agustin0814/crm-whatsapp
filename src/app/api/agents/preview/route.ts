import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LIMITS, isQuickReplyUsable, parseAgentConfig } from "@/lib/agents/config";
import { allowedTypes, planReply } from "@/lib/agents/engine";
import { estimateCostUsd } from "@/lib/agents/guards";
import { buildHistory, buildSystemPrompt, buildUnansweredTurn, type PromptMessage } from "@/lib/agents/prompt";
import { ModelProviderError } from "@/lib/agents/provider";
import { applyTemplate } from "@/lib/crm/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Llama al modelo (hasta 2 veces con el reintento de cobertura).
export const maxDuration = 60;

const MAX_INPUT_MESSAGES = 10;
const MAX_INPUT_CHARS = 1000;

type Body = {
  agentKey?: unknown;
  /** Mensajes del cliente sin responder (la ráfaga), en orden. */
  messages?: unknown;
  /** Conversación previa opcional: [{ de: "cliente" | "agente", texto }]. */
  history?: unknown;
  /** Nombre del cliente ficticio (para las variables de las respuestas rápidas). */
  contactName?: unknown;
};

function texts(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((t): t is string => typeof t === "string" && t.trim() !== "")
        .map((t) => t.trim().slice(0, MAX_INPUT_CHARS))
        .slice(0, MAX_INPUT_MESSAGES)
    : [];
}

/**
 * Probador SIN envío (base de la pestaña «Probador»): arma el mismo prompt que
 * el motor con la configuración real del agente y devuelve lo que respondería
 * (mensajes, preguntas detectadas y cobertura, tokens y costo). No envía nada a
 * WhatsApp ni escribe en la base. Solo superadmin.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Solo el proveedor puede usar el probador" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const agentKey = typeof body.agentKey === "string" && body.agentKey ? body.agentKey : "responder";
  const burst = texts(body.messages);
  if (!burst.length) return NextResponse.json({ error: "Manda al menos un mensaje del cliente en «messages»" }, { status: 400 });
  const contactName = typeof body.contactName === "string" ? body.contactName.trim().slice(0, 60) : "Cliente de prueba";
  const prior = Array.isArray(body.history)
    ? body.history
        .map((h) => (h && typeof h === "object" ? (h as Record<string, unknown>) : {}))
        .filter((h) => typeof h.texto === "string" && h.texto.trim() !== "")
        .slice(-20)
        .map((h): PromptMessage => ({
          direction: h.de === "agente" ? "outbound" : "inbound",
          type: "text",
          body: String(h.texto).slice(0, MAX_INPUT_CHARS),
        }))
    : [];

  const admin = createAdminClient();
  const { data: agent } = await admin.from("agents").select("kind, config, agent_locked_config(*)").eq("key", agentKey).maybeSingle();
  const locked = agent?.agent_locked_config;
  // El probador simula respuestas: solo aplica al Asistente de respuestas.
  if (!agent || !locked || agent.kind !== "responder") return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
  const config = parseAgentConfig(agent.config, {
    ...DEFAULT_LIMITS,
    max_consecutive_max: locked.max_consecutive_ceiling,
    daily_cap_max: locked.daily_cap_ceiling,
    delay_seconds_min: locked.delay_seconds_min,
    delay_seconds_max: locked.delay_seconds_max,
  });

  const { data: quickReplies } = await admin
    .from("quick_replies")
    .select("id, shortcut, body, when_to_use, agent_permission")
    .neq("agent_permission", "human_only")
    .order("shortcut");
  const allowedReplies = (quickReplies ?? []).filter((q) => isQuickReplyUsable(q, config));
  const previousReplies = prior.filter((m) => m.direction === "outbound").map((m) => m.body ?? "").slice(-5);

  const system = buildSystemPrompt({
    lockedSystemPrompt: locked.system_prompt,
    lockedSafetyRules: locked.safety_rules,
    businessInfo: locked.business_info,
    escalationTopics: locked.escalation_topics,
    config,
    quickReplies: allowedReplies,
    contactFirstName: contactName.split(/\s+/)[0] || null,
    agentAlreadySpoke: previousReplies.length > 0,
    previousReplies,
    allowed: allowedTypes(locked),
  });

  try {
    const planned = await planReply({
      system,
      turns: [...buildHistory(prior), buildUnansweredTurn(burst.map((b) => ({ direction: "inbound", type: "text", body: b })))],
      locked,
      allowedShortcuts: allowedReplies.map((q) => q.shortcut),
    });
    const { validation } = planned;
    const fakeContact = { name: contactName, wa_id: "5210000000000", phone: "5210000000000", company: null };
    const outcome = !validation.ok
      ? { accion: "transferir (respuesta incompleta)", problemas: validation.problems }
      : validation.action === "transfer"
        ? { accion: "transferir", motivo: validation.reason }
        : {
            accion: "responder",
            mensajes: validation.messages.map((m) => {
              if (m.kind === "text") return { tipo: "texto", texto: m.text };
              const reply = allowedReplies.find((q) => q.shortcut === m.shortcut);
              return { tipo: "respuesta_rapida", shortcut: `/${m.shortcut}`, texto: reply ? applyTemplate(reply.body, fakeContact) : "" };
            }),
          };
    return NextResponse.json({
      enviado: false,
      modelo: planned.model,
      reintento: planned.retried,
      preguntas_detectadas: validation.coverage,
      ...outcome,
      tokens: planned.usage,
      costo_estimado_usd: estimateCostUsd(planned.usage, {
        input_price_per_mtok: Number(locked.input_price_per_mtok),
        output_price_per_mtok: Number(locked.output_price_per_mtok),
      }),
      respuestas_rapidas_habilitadas: allowedReplies.map((q) => ({ shortcut: `/${q.shortcut}`, cuando_usarla: q.when_to_use })),
    });
  } catch (error) {
    const message = error instanceof ModelProviderError ? error.message : "Error del modelo";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
