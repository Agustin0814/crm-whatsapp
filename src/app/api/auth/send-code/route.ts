import { after, NextResponse, type NextRequest } from "next/server";
import { createAnonClient, limitKey } from "@/lib/auth-codes-server";
import { isValidEmail, normalizeEmail, RESEND_SECONDS } from "@/lib/auth-codes";
import { createAdminClient } from "@/lib/supabase/admin";

// Envía el código de 6 dígitos para recuperar la contraseña (ruta pública).
// La respuesta es SIEMPRE la misma exista o no la cuenta: nunca revela qué
// correos están registrados. Límites propios (auth_code_reserve_send: 60 s
// entre envíos y 5 por hora por correo) además de los de Supabase.

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });

  const admin = createAdminClient();
  // La espera se aplica por correo escrito, exista o no: no da pistas.
  const { data: reserve, error: reserveError } = await admin.rpc("auth_code_reserve_send", {
    p_key: limitKey(email),
    p_cooldown: RESEND_SECONDS,
    p_max_per_hour: 5,
  });
  if (reserveError) {
    console.error("[auth-code] No se pudo reservar el envío");
    return NextResponse.json({ error: "No se pudo enviar el código. Inténtalo de nuevo." }, { status: 500 });
  }
  const reserved = reserve as { ok: boolean; retry_after: number };
  if (!reserved.ok) {
    return NextResponse.json(
      { error: "Espera antes de pedir otro código.", retryAfter: reserved.retry_after },
      { status: 429 },
    );
  }

  // Solo se envía a cuentas activas; a las demás no, pero la respuesta es igual.
  // Va en after(): la respuesta tarda lo mismo exista o no la cuenta.
  after(async () => {
    const { data: status } = await admin.rpc("auth_account_status", { p_email: email });
    if (status !== "active") return;
    const { error } = await createAnonClient().auth.resetPasswordForEmail(email);
    // Sin el correo en el log. Un 429 de Supabase tampoco se revela al cliente.
    if (error) console.error(`[auth-code] Supabase no envió el código (${error.status ?? "?"} ${error.code ?? ""})`);
  });

  return NextResponse.json({ ok: true, retryAfter: reserved.retry_after });
}
