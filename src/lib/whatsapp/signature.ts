import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida la cabecera X-Hub-Signature-256 ("sha256=<hex>") que firma Meta
 * con el App Secret sobre el body crudo. Comparación en tiempo constante.
 */
export function isValidSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const received = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest();

  // timingSafeEqual exige la misma longitud; si difiere, la firma es inválida.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
