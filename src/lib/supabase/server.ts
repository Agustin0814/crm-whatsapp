import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./public-env";

/**
 * Cliente de Supabase con la sesión del usuario (cookies).
 * Crear uno por petición; usar en route handlers, server actions y server components.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Desde un Server Component no se pueden escribir cookies;
          // el proxy se encarga de refrescar la sesión.
        }
      },
    },
  });
}
