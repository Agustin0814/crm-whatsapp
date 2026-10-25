// Ventana de atención de 24 h de WhatsApp. Se usa en el cliente (aviso y
// bloqueo del input) y en el servidor (validación antes de enviar).

export const WINDOW_MS = 24 * 60 * 60 * 1000;

/** true si se puede enviar texto libre (último mensaje del cliente hace < 24 h). */
export function isWindowOpen(
  lastInboundAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!lastInboundAt) return false;
  const last = new Date(lastInboundAt).getTime();
  return Number.isFinite(last) && now - last < WINDOW_MS;
}

/** Milisegundos que le quedan a la ventana (0 si está cerrada). */
export function windowRemainingMs(
  lastInboundAt: string | null,
  now: number = Date.now(),
): number {
  if (!lastInboundAt) return 0;
  const last = new Date(lastInboundAt).getTime();
  return Number.isFinite(last) ? Math.max(0, last + WINDOW_MS - now) : 0;
}
