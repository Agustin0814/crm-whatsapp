import "server-only";
import { openAiProvider } from "./providers/openai";

// Capa de proveedor de modelo, agnóstica: el motor solo conoce esta interfaz.
// Para cambiar de proveedor se agrega otra implementación y se elige aquí.

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema de los argumentos (objeto, sin propiedades adicionales). */
  parameters: Record<string, unknown>;
};

export type GenerateLimits = {
  model: string;
  maxOutputTokens: number;
  reasoningEffort: "minimal" | "low" | "medium" | "high";
  temperature: number | null;
};

export type GenerateReplyInput = {
  system: string;
  messages: ChatTurn[];
  tools: ToolDefinition[];
  limits: GenerateLimits;
};

export type GenerateReplyResult = {
  /** Herramienta elegida por el modelo (null si respondió sin herramienta). */
  toolCall: { name: string; arguments: Record<string, unknown> } | null;
  /** Texto libre, si el modelo lo devolvió en lugar de una herramienta. */
  text: string | null;
  /** Tokens reales que reporta la API. */
  usage: { inputTokens: number; outputTokens: number };
  model: string;
};

export interface ModelProvider {
  generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult>;
}

export class ModelProviderError extends Error {
  constructor(
    message: string,
    /** Tokens consumidos aunque falle (p. ej. respuesta truncada). */
    readonly usage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 },
  ) {
    super(message);
    this.name = "ModelProviderError";
  }
}

export function getModelProvider(): ModelProvider {
  return openAiProvider;
}
