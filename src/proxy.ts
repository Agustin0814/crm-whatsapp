import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/permissions";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/public-env";

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = [
  "/login",
  "/olvide-contrasena",
  // Código de 6 dígitos: se pide y se verifica sin sesión (límites en la base).
  "/api/auth/send-code",
  "/api/auth/verify-code",
  // Solo redirige los enlaces de correos anteriores a la pantalla del código.
  "/auth/confirm",
];
/** Accesibles con o sin sesión (activar cuenta invitada). */
const OPEN_PATHS = ["/definir-contrasena"];

/**
 * Refresca la sesión de Supabase en cada petición y protege las rutas:
 * sin sesión → /login; con sesión en /login → /; cuenta inactiva → se cierra
 * la sesión y /login?motivo=inactivo; ruta no permitida para el rol → /
 * (canAccessPath, la misma regla que usa el menú). Las APIs validan su propio
 * rol; aquí solo se rechaza a quien no tiene cuenta activa.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // getUser() valida el token contra Supabase Auth (no confiar solo en la cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);
  if (OPEN_PATHS.includes(pathname)) return response;

  if (!user && !isPublic) {
    // Las APIs responden 401 en lugar de redirigir.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return redirectWithCookies(request, response, "/login");
  }

  if (user && pathname === "/login") {
    return redirectWithCookies(request, response, "/");
  }

  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_active) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Tu cuenta no está activa" }, { status: 403 });
      }
      await supabase.auth.signOut({ scope: "local" });
      return redirectWithCookies(request, response, "/login", "?motivo=inactivo");
    }

    if (!pathname.startsWith("/api/") && !canAccessPath(profile.role, pathname)) {
      return redirectWithCookies(request, response, "/");
    }
  }

  return response;
}

/** Redirige conservando las cookies de sesión que se hayan refrescado. */
function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  search = "",
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    // Todo excepto archivos estáticos (imágenes, sonidos, manifest), el webhook
    // de Meta (no tiene sesión; se protege con la firma X-Hub-Signature-256) y
    // el procesador de agentes (lo llama pg_cron; se protege con CRON_SECRET).
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/whatsapp/webhook|api/agents/run|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3)$).*)",
  ],
};
