// Preferencia de la barra lateral (abierta/recogida) en pantallas ≥ 1024 px.
// Se guarda en una cookie para que el servidor pinte el estado correcto desde
// el primer render, sin parpadeo. Valor "1" = recogida, "0" = abierta.

export const SIDEBAR_COOKIE = "sidebar_collapsed";

/** Un año. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Lee el valor de la cookie (servidor). Sin cookie → abierta. */
export function parseSidebarCookie(value: string | undefined): boolean {
  return value === "1";
}

/** Guarda la preferencia (navegador). No es un dato sensible: sin HttpOnly. */
export function writeSidebarCookie(collapsed: boolean): void {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "1" : "0"}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
