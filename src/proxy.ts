import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/public-env";

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ["/login"];

/**
 * Refresca la sesión de Supabase en cada petición y protege las rutas:
 * sin sesión → /login; con sesión en /login → /.
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

  if (!user && !isPublic) {
    // Las APIs responden 401 en lugar de redirigir.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return redirectWithCookies(request, response, "/login");
  }

  if (user && isPublic) {
    return redirectWithCookies(request, response, "/");
  }

  return response;
}

/** Redirige conservando las cookies de sesión que se hayan refrescado. */
function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
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
