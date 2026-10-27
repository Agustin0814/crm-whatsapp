// Reglas mínimas de contraseña, compartidas por «Mi perfil» y la página de
// definir/restablecer contraseña. Supabase Auth aplica además su propio mínimo.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // límite de bcrypt

export type PasswordRule = { id: string; label: string; ok: boolean };

export function passwordRules(password: string): PasswordRule[] {
  return [
    { id: "largo", label: `Al menos ${PASSWORD_MIN} caracteres`, ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { id: "letra", label: "Una letra", ok: /\p{L}/u.test(password) },
    { id: "numero", label: "Un número", ok: /\d/.test(password) },
  ];
}

/** Error a mostrar, o null si la contraseña y su confirmación son válidas. */
export function passwordError(password: string, confirm: string): string | null {
  if (passwordRules(password).some((r) => !r.ok)) return "La contraseña no cumple los requisitos.";
  if (password !== confirm) return "Las contraseñas no coinciden.";
  return null;
}

/** Mensaje claro para los errores de Supabase Auth al cambiar la contraseña. */
export function updatePasswordErrorMessage(error: { code?: string; status?: number }): string {
  if (error.code === "same_password") return "La nueva contraseña debe ser distinta de la anterior.";
  if (error.code === "weak_password") return "La contraseña es muy débil o aparece en filtraciones conocidas. Elige otra.";
  if (error.code === "reauthentication_needed") return "Por seguridad, vuelve a iniciar sesión y cambia la contraseña de nuevo.";
  if (error.status === 429) return "Demasiados intentos. Espera un momento.";
  return "No se pudo guardar la contraseña. Inténtalo de nuevo.";
}
