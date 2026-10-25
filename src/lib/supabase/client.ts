import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./public-env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

/** Cliente de Supabase para el navegador (usa la sesión del usuario y respeta RLS). */
export function createClient() {
  browserClient ??= createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
  return browserClient;
}
