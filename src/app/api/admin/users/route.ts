import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isAssignableRole } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

// Gestión de usuarios (solo administrador y superadmin). Nada se borra: al
// desactivar se conserva el historial.
// - Los cambios de rol, puesto y estado se guardan con la SESIÓN del admin: la
//   base los valida (RLS + trigger profiles_protect_role: no tocar al proveedor,
//   no desactivarse a sí mismo, no dejar el sistema sin administradores activos).
// - La service role solo se usa DESPUÉS de verificar sesión y rol, para lo que
//   vive en Auth: correos, invitar, bloquear el acceso y cerrar sesiones.

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  job_title: string | null;
  is_active: boolean;
  avatar_color: number | null;
  avatar_emoji: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  /** Invitado que aún no define su contraseña. */
  invite_pending: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Bloqueo en Auth al desactivar (~100 años). */
const BAN_FOREVER = "876000h";

function deny(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function cleanJobTitle(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, 60);
  return text || null;
}

/** Mensaje claro a partir del error de la base (los triggers ya traen texto en español). */
function dbError(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "42501" || error.code === "P0001") return error.message ?? fallback;
  return fallback;
}

/** Lista de usuarios con su correo. El superadmin solo aparece para otro superadmin (RLS). */
export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return deny(check.status, check.error);

  const admin = createAdminClient();
  const [{ data: authData, error: authError }, { data: profiles, error: profilesError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    // Con la sesión del admin: RLS oculta al proveedor.
    check.supabase.from("profiles").select("*").order("created_at"),
  ]);
  if (authError || profilesError) {
    console.error("[admin-users] Error al listar usuarios");
    return deny(500, "No se pudieron cargar los usuarios");
  }

  const authById = new Map(authData.users.map((u) => [u.id, u]));
  const users: AdminUser[] = profiles.map((p) => {
    const auth = authById.get(p.id);
    return {
      id: p.id,
      email: auth?.email ?? null,
      full_name: p.full_name,
      role: p.role,
      job_title: p.job_title,
      is_active: p.is_active,
      avatar_color: p.avatar_color,
      avatar_emoji: p.avatar_emoji,
      created_at: p.created_at,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      invite_pending: Boolean(auth?.invited_at) && !auth?.last_sign_in_at,
    };
  });
  return NextResponse.json({ users });
}

/**
 * Invita por correo (o reenvía la invitación) con rol y puesto. El enlace
 * lleva a /auth/confirm → /definir-contrasena.
 */
export async function POST(request: NextRequest) {
  const check = await requireAdmin();
  if (!check.ok) return deny(check.status, check.error);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 80) : "";
  const jobTitle = cleanJobTitle(body.jobTitle) ?? null;
  const role = body.role;

  if (!EMAIL_RE.test(email)) return deny(400, "Correo no válido");
  if (!isAssignableRole(role)) return deny(400, "Rol no válido");

  const admin = createAdminClient();
  const redirectTo = `${request.nextUrl.origin}/auth/confirm?next=/definir-contrasena`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName || email },
  });
  if (error || !data.user) {
    // Nunca se registra el correo en los logs.
    console.error(`[admin-users] No se pudo invitar (${error?.status ?? "?"} ${error?.code ?? ""})`);
    const exists = error?.code === "email_exists" || error?.message?.toLowerCase().includes("already");
    if (error?.status === 429) return deny(429, "Se enviaron demasiados correos. Espera un momento.");
    return deny(
      exists ? 409 : 400,
      exists ? "Ya existe un usuario con ese correo" : "No se pudo enviar la invitación. Revisa la configuración de correo.",
    );
  }

  // El trigger crea el perfil INACTIVO; aquí se activa con su rol (ya validado arriba).
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role, job_title: jobTitle, is_active: true, ...(fullName ? { full_name: fullName } : {}) })
    .eq("id", data.user.id);
  if (profileError) {
    console.error("[admin-users] Invitado, pero no se pudo asignar el perfil");
    return deny(500, "Se envió la invitación, pero no se pudo asignar el rol. Revísalo en la lista.");
  }
  return NextResponse.json({ id: data.user.id }, { status: 201 });
}

/** Cambia rol, puesto o estado (activo/inactivo) de un usuario. */
export async function PATCH(request: NextRequest) {
  const check = await requireAdmin();
  if (!check.ok) return deny(check.status, check.error);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return deny(400, "Id no válido");

  const patch: { role?: string; job_title?: string | null; is_active?: boolean } = {};
  if (body.role !== undefined) {
    if (!isAssignableRole(body.role)) return deny(400, "Rol no válido");
    patch.role = body.role;
  }
  const jobTitle = cleanJobTitle(body.jobTitle);
  if (jobTitle !== undefined) patch.job_title = jobTitle;
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return deny(400, "Estado no válido");
    if (!body.active && id === check.userId) return deny(400, "No puedes desactivar tu propia cuenta");
    patch.is_active = body.active;
  }
  if (Object.keys(patch).length === 0) return deny(400, "Nada que cambiar");

  // Con la sesión del admin: RLS y el trigger deciden.
  const { data: updated, error } = await check.supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select("id, is_active")
    .maybeSingle();
  if (error) return deny(400, dbError(error, "No se pudo guardar el cambio"));
  if (!updated) return deny(404, "Usuario no encontrado");

  if (patch.is_active !== undefined) {
    const admin = createAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: patch.is_active ? "none" : BAN_FOREVER,
    });
    if (banError) {
      console.error(`[admin-users] No se pudo actualizar el bloqueo en Auth (${banError.status ?? "?"})`);
      // El perfil ya quedó inactivo: RLS le niega todo aunque Auth falle.
      return deny(500, "El estado se guardó, pero no se pudo actualizar el acceso. Inténtalo de nuevo.");
    }
    if (!patch.is_active) {
      const { error: revokeError } = await admin.rpc("admin_revoke_sessions", { p_user_id: id });
      if (revokeError) console.error("[admin-users] No se pudieron cerrar las sesiones");
    }
  }
  return NextResponse.json({ ok: true });
}
