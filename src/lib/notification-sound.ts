import { BRAND_ASSETS } from "@/lib/brand";

/** Intervalo mínimo entre sonidos (si llegan varios mensajes a la vez suena uno). */
const MIN_INTERVAL_MS = 1000;
const VOLUME = 0.5;

export type NotificationSound = {
  /** Reproduce el sonido (respeta el intervalo mínimo). Nunca lanza. */
  play: () => void;
  /** Quita los listeners de desbloqueo. */
  dispose: () => void;
};

/**
 * Sonido de mensaje entrante con public/sounds/notificacion.mp3.
 *
 * Los navegadores bloquean el audio hasta que el usuario interactúa con la
 * página. Tras el primer clic o tecla se "desbloquea" el elemento <audio>
 * reproduciéndolo en silencio y pausándolo; a partir de ahí play() funciona
 * aunque la llamada venga de un evento de Realtime. Si el navegador aún
 * rechaza play(), la promesa se captura y no se lanza ningún error.
 */
export function createNotificationSound(): NotificationSound {
  const audio = new Audio(BRAND_ASSETS.sonidoNotificacion);
  audio.preload = "auto";
  audio.volume = VOLUME;
  let unlocked = false;
  let unlocking = false;
  /** Se pidió un sonido real mientras se desbloqueaba (p. ej. el clic en «Probar»). */
  let realPlayPending = false;
  let lastPlayed = 0;

  const unlock = () => {
    if (unlocked || unlocking) return;
    unlocking = true;
    realPlayPending = false;
    audio.muted = true;
    audio
      .play()
      .then(() => {
        unlocked = true;
        removeListeners();
        audio.muted = false;
        // Si en medio llegó un play() real, se deja sonar; si no, se detiene.
        if (!realPlayPending) {
          audio.pause();
          audio.currentTime = 0;
        }
      })
      .catch(() => {
        audio.muted = false; // se reintenta con la siguiente interacción
      })
      .finally(() => {
        unlocking = false;
      });
  };

  const events = ["pointerdown", "keydown"] as const;
  const removeListeners = () => events.forEach((e) => window.removeEventListener(e, unlock));
  events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));

  return {
    play() {
      const now = Date.now();
      if (now - lastPlayed < MIN_INTERVAL_MS) return;
      lastPlayed = now;
      if (unlocking) realPlayPending = true;
      try {
        audio.muted = false;
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
      } catch {
        // Audio no disponible: se ignora.
      }
    },
    dispose: removeListeners,
  };
}
