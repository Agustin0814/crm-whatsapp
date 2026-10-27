import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/public-env";

/**
 * Llave de los límites (auth_code_limits): SHA-256 del correo normalizado.
 * Nunca se guarda ni se registra el correo.
 */
export function limitKey(email: string): string {
  return createHash("sha256").update(`codigo:${email}`).digest("hex");
}

/**
 * Cliente anónimo sin sesión ni almacenamiento, para pedir el código de
 * recuperación desde el servidor (no deja cookies de PKCE en el navegador).
 */
export function createAnonClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
