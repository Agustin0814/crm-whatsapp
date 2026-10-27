import { NextResponse, type NextRequest } from "next/server";
import { limitKey } from "@/lib/auth-codes-server";
import {
  formatWait,
  isCodePurpose,
  isValidCode,
  isValidEmail,
  LOCK_MINUTES,
  MAX_FAILED_ATTEMPTS,
  normalizeEmail,
} from "@/lib/auth-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Verifica el código de 6 dígitos (recuperación o invitación) con
// verifyOtp. Si es correcto deja la sesión en las cookies para que la
// página guarde la contraseña nueva. Límite propio: 5 fallos → 15 min de
// bloqueo por correo (auth_code_register_failure), además del de Supabase.

const INACTIVE = "Tu cuenta está desactivada. Si crees que es un error, pide ayuda a un administrador.";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const type = body.type;
  if (!isValidEmail(email) || !isValidCode(code) || !isCodePurpose(type)) {
    return NextResponse.json({ error: "Escribe tu correo y el código de 6 dígitos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const key = limitKey(email);
  const { data: lockRemaining } = await admin.rpc("auth_code_lock_remaining", { p_key: key });
  if ((lockRemaining ?? 0) > 0) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${formatWait(lockRemaining ?? 0)} y vuelve a intentarlo.`, retryAfter: lockRemaining },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type });

  if (error || !data.user) {
    if (error?.code === "user_banned") return NextResponse.json({ error: INACTIVE }, { status: 403 });
    if (error?.status === 429) {
      return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
    }
    const { data: failure } = await admin.rpc("auth_code_register_failure", {
      p_key: key,
      p_max: MAX_FAILED_ATTEMPTS,
      p_lock_minutes: LOCK_MINUTES,
    });
    const result = (failure ?? { locked: false, remaining: 0 }) as { locked: boolean; remaining: number; retry_after: number };
    if (result.locked) {
      return NextResponse.json(
        { error: `Demasiados intentos. Espera ${LOCK_MINUTES} min y pide un código nuevo.`, retryAfter: result.retry_after },
        { status: 429 },
      );
    }
    // Supabase no distingue «incorrecto» de «vencido» (otp_expired para ambos).
    const left = result.remaining === 1 ? "Te queda 1 intento." : `Te quedan ${result.remaining} intentos.`;
    return NextResponse.json(
      { error: `El código es incorrecto o ya venció. Revisa el último correo o pide uno nuevo. ${left}` },
      { status: 400 },
    );
  }

  await admin.rpc("auth_code_reset", { p_key: key });

  // Una cuenta desactivada no recupera ni activa: se cierra la sesión recién creada.
  const { data: profile } = await admin.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({ error: INACTIVE }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
