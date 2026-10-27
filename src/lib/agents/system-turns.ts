import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { sanitizeTurn, type StoredTurn } from "./system-plan";

// Turnos del CHAT TEMPORAL: no se guardan en la base. El navegador conserva cada
// turno firmado por el servidor (HMAC) y lo devuelve como historial o para
// guardarlo con nombre. Así nadie puede inventar resultados de herramientas ni
// bajar el rol mínimo de un chat guardado: lo que no tenga firma válida se ignora.

const VERSION = 1;

function key(): Buffer {
  // Llave propia del asistente, derivada del secreto del servidor (nunca sale de aquí).
  return createHmac("sha256", serverEnv("CRON_SECRET")).update("assistant-turn-v1").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

export function signTurn(turn: StoredTurn, userId: string): string {
  const payload = Buffer.from(JSON.stringify({ v: VERSION, u: userId, t: turn })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Turno firmado por este servidor para este usuario, o null. */
export function verifyTurn(token: unknown, userId: string): StoredTurn | null {
  if (typeof token !== "string" || token.length > 200_000) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v?: number; u?: string; t?: StoredTurn };
    if (parsed.v !== VERSION || parsed.u !== userId || !parsed.t) return null;
    return sanitizeTurn(parsed.t);
  } catch {
    return null;
  }
}
