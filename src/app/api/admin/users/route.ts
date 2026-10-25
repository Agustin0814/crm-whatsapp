import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Gestión de usuarios (solo admin). Usa la service role ÚNICAMENTE después de
// verificar sesión y rol; nunca se expone al navegador. Los cambios de rol no
// pasan por aquí: se hacen con la sesión del admin y los valida la base (RLS + trigger).

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function deny(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** Lista de usuarios con su correo (el correo solo vive en auth.users). */
export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return deny(check.status, check.error);

  const admin = createAdminClient();
  const [{ data: authData, error: authError }, { data: profiles, error: profilesError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("*").order("created_at"),
  ]);
  if (authError || profilesError) {
    console.error("[admin-users] Error al listar usuarios");
    return deny(500, "No se pudieron cargar los usuarios");
  }

  const emails = new Map(authData.users.map((u) => [u.id, u]));
  const users: AdminUser[] = profiles.map((p) => ({
    id: p.id,
    email: emails.get(p.id)?.email ?? null,
    full_name: p.full_name,
    role: p.role,
    created_at: p.created_at,
    last_sign_in_at: emails.get(p.id)?.last_sign_in_at ?? null,
  }));
  return NextResponse.json({ users });
}

/** Crea un usuario con correo y contraseña temporal. */
export async function POST(request: NextRequest) {
  const check = await requireAdmin();
  if (!check.ok) return deny(check.status, check.error);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const role = body.role === "admin" ? "admin" : "agent";

  if (!EMAIL_RE.test(email)) return deny(400, "Correo no válido");
  if (password.length < MIN_PASSWORD) return deny(400, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email },
  });
  if (error || !data.user) {
    // No se registra el correo ni la contraseña en los logs.
    console.error(`[admin-users] No se pudo crear el usuario (${error?.status ?? "?"})`);
    const exists = error?.message?.toLowerCase().includes("already");
    return deny(exists ? 409 : 400, exists ? "Ya existe un usuario con ese correo" : "No se pudo crear el usuario");
  }

  // El trigger on_auth_user_created crea el perfil como "agent".
  if (role === "admin") {
    const { error: roleError } = await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    if (roleError) console.error("[admin-users] Usuario creado, pero no se pudo asignar el rol admin");
  }

  return NextResponse.json({ id: data.user.id }, { status: 201 });
}

/** Elimina un usuario (?id=). No se puede eliminar a uno mismo ni al último admin. */
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin();
  if (!check.ok) return deny(check.status, check.error);

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return deny(400, "Id no válido");
  if (id === check.userId) return deny(400, "No puedes eliminar tu propia cuenta");

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
  if (target?.role === "admin") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return deny(400, "Debe quedar al menos un administrador");
  }

  // Borra auth.users; profiles se elimina en cascada y sus conversaciones,
  // mensajes y notas conservan el historial (assigned_to/sender_id/author_id → null).
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    console.error(`[admin-users] No se pudo eliminar el usuario (${error.status ?? "?"})`);
    return deny(500, "No se pudo eliminar el usuario");
  }
  return NextResponse.json({ ok: true });
}
