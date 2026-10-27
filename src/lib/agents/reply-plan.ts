// Contrato con el modelo: UNA sola función `responder` con salida estructurada.
// El modelo primero lista las preguntas o necesidades del cliente y con qué
// mensaje cubre cada una; el servidor valida que TODAS queden cubiertas.
// Lógica pura (sin red ni base): la usan el motor, el probador y las pruebas.

import type { ToolDefinition } from "./provider";

/** Máximo de mensajes de una respuesta. */
export const MAX_PLAN_MESSAGES = 3;

/** Herramientas internas de la capa del proveedor que habilitan cada tipo. */
export const TOOL_QUICK_REPLY = "enviar_respuesta_rapida";
export const TOOL_TEXT = "responder_texto_corto";
export const TOOL_TRANSFER = "transferir_a_humano";

export const RESPONDER_TOOL: ToolDefinition = {
  name: "responder",
  description:
    "Única forma de responder. Primero lista cada pregunta o necesidad distinta del cliente y qué mensaje la cubre; luego los mensajes, en el orden en que se envían.",
  parameters: {
    type: "object",
    properties: {
      preguntas_detectadas: {
        type: "array",
        description:
          "Uso interno (no se envía al cliente). Una entrada por cada pregunta o necesidad DISTINTA de los «Mensajes del cliente sin responder». Incluye también saludos o agradecimientos si piden respuesta.",
        items: {
          type: "object",
          properties: {
            pregunta: { type: "string", description: "La pregunta o necesidad, resumida" },
            cubierta_por: {
              type: "array",
              description: "Números (desde 1) de los mensajes de la lista que la responden",
              items: { type: "integer" },
            },
          },
          required: ["pregunta", "cubierta_por"],
          additionalProperties: false,
        },
      },
      accion: {
        type: "string",
        enum: ["responder", "transferir"],
        description: "«transferir» pasa la conversación a una persona (no hace falta llenar mensajes).",
      },
      motivo_transferencia: {
        type: ["string", "null"],
        description: "Solo si accion = transferir: motivo breve para el equipo (no se envía al cliente).",
      },
      mensajes: {
        type: "array",
        description: `De 1 a ${MAX_PLAN_MESSAGES} mensajes, en orden. Vacío si accion = transferir.`,
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["respuesta_rapida", "texto"] },
            shortcut: { type: ["string", "null"], description: "Atajo exacto si tipo = respuesta_rapida; si no, null" },
            contenido: { type: ["string", "null"], description: "Texto para el cliente si tipo = texto; si no, null" },
          },
          required: ["tipo", "shortcut", "contenido"],
          additionalProperties: false,
        },
      },
    },
    required: ["preguntas_detectadas", "accion", "motivo_transferencia", "mensajes"],
    additionalProperties: false,
  },
};

export type PlanMessage = { kind: "quick_reply"; shortcut: string } | { kind: "text"; text: string };

export type ReplyPlan = {
  action: "respond" | "transfer";
  transferReason: string;
  questions: { question: string; coveredBy: number[] }[];
  /** Mensajes tal como los mandó el modelo (con su posición original, desde 1). */
  messages: (PlanMessage | null)[];
};

/** Resumen para agent_usage_log.coverage (depuración; nunca se envía al cliente). */
export type CoverageEntry = { q: string; m: number[]; ok: boolean };

export type PlanValidation =
  | { ok: true; action: "transfer"; reason: string; coverage: CoverageEntry[] }
  | { ok: true; action: "respond"; messages: PlanMessage[]; coverage: CoverageEntry[] }
  | { ok: false; problems: string[]; coverage: CoverageEntry[] };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Lee los argumentos de `responder`. Nunca lanza: lo inválido queda como null. */
export function parseReplyPlan(args: Record<string, unknown>): ReplyPlan {
  const rawQuestions = Array.isArray(args.preguntas_detectadas) ? args.preguntas_detectadas : [];
  const questions = rawQuestions
    .map((q) => {
      const o = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
      const coveredBy = Array.isArray(o.cubierta_por)
        ? o.cubierta_por.map(Number).filter((n) => Number.isInteger(n) && n >= 1)
        : [];
      return { question: str(o.pregunta).slice(0, 200), coveredBy };
    })
    .filter((q) => q.question !== "");
  const rawMessages = Array.isArray(args.mensajes) ? args.mensajes : [];
  const messages = rawMessages.map((m): PlanMessage | null => {
    const o = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
    if (o.tipo === "respuesta_rapida") {
      const shortcut = str(o.shortcut).replace(/^\//, "");
      return shortcut ? { kind: "quick_reply", shortcut } : null;
    }
    if (o.tipo === "texto") {
      const text = str(o.contenido);
      return text ? { kind: "text", text } : null;
    }
    return null;
  });
  return {
    action: args.accion === "transferir" ? "transfer" : "respond",
    transferReason: str(args.motivo_transferencia).slice(0, 200),
    questions,
    messages,
  };
}

/**
 * Valida un plan con los permisos vigentes:
 *  - transferir solo si la capa del proveedor lo permite;
 *  - cada mensaje debe ser de un tipo permitido (respuesta rápida habilitada o texto);
 *  - debe haber al menos una pregunta detectada y CADA una debe quedar cubierta
 *    por al menos un mensaje válido.
 * Si algo falla, devuelve los problemas para reintentar o transferir.
 */
export function validateReplyPlan(
  plan: ReplyPlan,
  opts: { allowedTools: string[]; allowedShortcuts: string[]; maxMessages?: number },
): PlanValidation {
  const max = opts.maxMessages ?? MAX_PLAN_MESSAGES;
  const canTransfer = opts.allowedTools.includes(TOOL_TRANSFER);
  const canText = opts.allowedTools.includes(TOOL_TEXT);
  const canQuick = opts.allowedTools.includes(TOOL_QUICK_REPLY);
  const shortcuts = new Set(opts.allowedShortcuts);

  if (plan.action === "transfer") {
    const coverage = plan.questions.map((q) => ({ q: q.question, m: [], ok: true }));
    if (canTransfer) return { ok: true, action: "transfer", reason: plan.transferReason, coverage };
    return { ok: false, problems: ["transferir no está permitido"], coverage };
  }

  const problems: string[] = [];
  // Posición original (desde 1) -> mensaje válido.
  const valid = new Map<number, PlanMessage>();
  plan.messages.slice(0, max).forEach((m, i) => {
    const pos = i + 1;
    if (!m) return problems.push(`el mensaje ${pos} está vacío o mal formado`);
    if (m.kind === "quick_reply") {
      if (!canQuick) return problems.push(`el mensaje ${pos} usa una respuesta rápida, que no está permitida`);
      if (!shortcuts.has(m.shortcut)) return problems.push(`/${m.shortcut} no es una respuesta rápida habilitada`);
    } else if (!canText) {
      return problems.push(`el mensaje ${pos} es texto libre, que no está permitido`);
    }
    valid.set(pos, m);
  });
  if (plan.messages.length > max) problems.push(`hay más de ${max} mensajes`);

  const coverage: CoverageEntry[] = plan.questions.map((q) => ({
    q: q.question,
    m: q.coveredBy,
    ok: q.coveredBy.some((n) => valid.has(n)),
  }));
  if (!plan.questions.length) problems.push("no se listó ninguna pregunta en preguntas_detectadas");
  for (const c of coverage) if (!c.ok) problems.push(`no se cubrió: «${c.q}»`);
  if (!valid.size) problems.push("no hay ningún mensaje válido");

  if (problems.length) return { ok: false, problems, coverage };
  return { ok: true, action: "respond", messages: [...valid.values()], coverage };
}

/** Aviso que se le da al modelo para el único reintento. */
export function retryNotice(problems: string[]): string {
  return `Aviso del sistema (no es del cliente): tu respuesta anterior no es válida porque ${problems.join("; ")}. Vuelve a llamar a «responder» cubriendo TODAS las preguntas del cliente con mensajes válidos (como máximo ${MAX_PLAN_MESSAGES}), o usa accion = transferir si no puedes responder alguna.`;
}
