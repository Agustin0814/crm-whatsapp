import "server-only";
import { isAdminRole, isRole, type Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type RoleCheck =
  | { ok: true; userId: string; role: Role; supabase: ServerClient }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Verifica sesión, perfil ACTIVO y que el rol esté entre los permitidos.
 * El perfil se lee con la sesión del propio usuario (RLS); la base vuelve a
 * validar todo con sus helpers (private.my_role y compañía).
 */
export async function requireRole(allowed: readonly Role[] | "any"): Promise<RoleCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active || !isRole(profile.role)) {
    return { ok: false, status: 403, error: "Tu cuenta no está activa" };
  }
  if (allowed !== "any" && !allowed.includes(profile.role)) {
    return { ok: false, status: 403, error: "Tu rol no tiene permiso para esto" };
  }
  return { ok: true, userId: user.id, role: profile.role, supabase };
}

export type AdminCheck =
  | { ok: true; userId: string; role: Role; supabase: ServerClient }
  | { ok: false; status: 401 | 403; error: string };

/** Sesión activa con rol administrador o superadmin. */
export async function requireAdmin(): Promise<AdminCheck> {
  const check = await requireRole(["admin", "superadmin"]);
  if (!check.ok && check.status === 403 && check.error.startsWith("Tu rol")) {
    return { ok: false, status: 403, error: "Solo un administrador puede hacer esto" };
  }
  if (check.ok && !isAdminRole(check.role)) return { ok: false, status: 403, error: "Solo un administrador puede hacer esto" };
  return check;
}
