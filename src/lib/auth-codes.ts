// Códigos de 6 dígitos por correo (recuperar contraseña y activar invitación).
// Lógica pura compartida por las pantallas y las rutas /api/auth/*.

export const CODE_LENGTH = 6;
/** Espera mínima entre reenvíos (la base también la aplica). */
export const RESEND_SECONDS = 60;
/** Intentos fallidos antes del bloqueo y duración del bloqueo (la base los aplica). */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export type CodePurpose = "recovery" | "invite";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

/** Solo dígitos, máximo 6 (al pegar «123 456» queda «123456»). */
export function cleanCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export function isValidCode(value: unknown): value is string {
  return typeof value === "string" && new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value);
}

export function isCodePurpose(value: unknown): value is CodePurpose {
  return value === "recovery" || value === "invite";
}

/** «15 min» o «45 s» para los mensajes de espera. */
export function formatWait(seconds: number): string {
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.max(1, Math.ceil(seconds))} s`;
}
