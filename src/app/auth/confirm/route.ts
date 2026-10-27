import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Destino de los enlaces de los correos de Supabase (invitación y recuperación).
// Admite las tres formas en que puede llegar el enlace:
//  1. ?token_hash=…&type=invite|recovery (plantilla recomendada): verifyOtp.
//  2. ?code=… (PKCE, recuperación pedida en este mismo navegador): exchangeCodeForSession.
//  3. Sin nada: los tokens vienen en el #hash (plantilla por defecto de una
//     invitación). El navegador conserva el hash al redirigir y la página
//     /definir-contrasena lo procesa.

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "signup", "email"];

/** Solo rutas internas (nunca otro dominio). */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/definir-contrasena";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const target = request.nextUrl.clone();
  target.search = "";
  const [path, query] = next.split("?");
  target.pathname = path;
  if (query) target.search = `?${query}`;

  const fail = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/olvide-contrasena";
    url.search = "?error=enlace";
    return NextResponse.redirect(url);
  };

  if (!tokenHash && !code) {
    // Caso 3: el hash (#access_token=…) viaja solo; la página lo procesa.
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail();
    target.searchParams.set("tipo", type === "invite" ? "invitacion" : "recuperacion");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail();
    target.searchParams.set("tipo", "recuperacion");
  } else {
    return fail();
  }
  return NextResponse.redirect(target);
}
