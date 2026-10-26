import "server-only";
import { isAdminRole } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/server";

export type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Verifica que la petición venga de un usuario con sesión y rol admin.
 * El rol se lee de profiles con la sesión del propio usuario (RLS).
 */
export async function requireAdmin(): Promise<AdminCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "No autenticado" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdminRole(profile?.role)) {
    return { ok: false, status: 403, error: "Solo un administrador puede hacer esto" };
  }
  return { ok: true, userId: user.id };
}
