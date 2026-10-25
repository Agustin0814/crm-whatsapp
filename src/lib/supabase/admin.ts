import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./database.types";
import { SUPABASE_URL } from "./public-env";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Cliente con SUPABASE_SERVICE_ROLE_KEY: se salta RLS.
 * Solo para el servidor (webhook de WhatsApp). Nunca importarlo en el cliente.
 */
export function createAdminClient() {
  adminClient ??= createClient<Database>(
    SUPABASE_URL,
    serverEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return adminClient;
}
