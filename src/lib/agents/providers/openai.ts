import "server-only";
import { serverEnv } from "@/lib/env";
import { ModelProviderError, type GenerateReplyInput, type GenerateReplyResult, type ModelProvider } from "../provider";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 30_000;

type ResponsesOutputItem =
  | { type: "function_call"; name: string; arguments: string; call_id: string }
  | { type: "message"; content?: { type: string; text?: string }[] }
  | { type: string };

type ResponsesBody = {
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: ResponsesOutputItem[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; code?: string } | null;
};

/**
 * Implementación con la Responses API de OpenAI (fetch, sin SDK).
 * La clave OPENAI_API_KEY solo existe en el servidor y nunca se registra.
 * `store: false`: OpenAI no guarda la conversación del cliente.
 */
export const openAiProvider: ModelProvider = {
  async generateReply({ system, messages, tools, limits }: GenerateReplyInput): Promise<GenerateReplyResult> {
    const payload: Record<string, unknown> = {
      model: limits.model,
      instructions: system,
      input: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: tools.map((t) => ({
        type: "function",
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        strict: true,
      })),
      // El agente siempre responde con UNA herramienta (nunca texto suelto).
      tool_choice: "required",
      parallel_tool_calls: false,
      max_output_tokens: limits.maxOutputTokens,
      reasoning: { effort: limits.reasoningEffort },
      store: false,
    };
    if (limits.temperature !== null) payload.temperature = limits.temperature;

    let response: Response;
    try {
      response = await fetch(RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverEnv("OPENAI_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ModelProviderError("No se pudo contactar al proveedor del modelo");
    }

    const data = (await response.json().catch(() => ({}))) as ResponsesBody;
    const usage = {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };

    if (!response.ok) {
      // Solo el código/mensaje del proveedor, nunca el payload (tiene datos del cliente).
      throw new ModelProviderError(`Proveedor HTTP ${response.status}: ${data.error?.code ?? data.error?.message ?? "error"}`, usage);
    }
    if (data.status === "incomplete") {
      throw new ModelProviderError(`Respuesta incompleta (${data.incomplete_details?.reason ?? "desconocido"})`, usage);
    }

    let toolCall: GenerateReplyResult["toolCall"] = null;
    let text: string | null = null;
    for (const item of data.output ?? []) {
      if (item.type === "function_call" && "name" in item && !toolCall) {
        let args: Record<string, unknown> = {};
        try {
          const parsed: unknown = JSON.parse(item.arguments || "{}");
          if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
        } catch {
          throw new ModelProviderError("Argumentos de herramienta no válidos", usage);
        }
        toolCall = { name: item.name, arguments: args };
      } else if (item.type === "message" && "content" in item) {
        const t = item.content?.map((c) => c.text ?? "").join("").trim();
        if (t) text = t;
      }
    }

    return { toolCall, text, usage, model: data.model ?? limits.model };
  },
};
