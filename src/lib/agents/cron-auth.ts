import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Valida «Authorization: Bearer <CRON_SECRET>» en tiempo constante.
 * Se comparan los hashes para no filtrar la longitud del secreto.
 */
export function isValidCronRequest(authorization: string | null): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const received = createHash("sha256").update(authorization.slice("Bearer ".length)).digest();
  const expected = createHash("sha256").update(serverEnv("CRON_SECRET")).digest();
  return timingSafeEqual(received, expected);
}
