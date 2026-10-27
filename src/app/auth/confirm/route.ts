import { NextResponse, type NextRequest } from "next/server";

// Solo para enlaces de correos ANTERIORES (antes de los códigos de 6 dígitos).
// Ya no verifica nada: lleva a la pantalla que corresponde con un aviso para
// pedir un código nuevo. Se puede retirar cuando ya no queden correos viejos.
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const type = url.searchParams.get("type");
  url.pathname = type === "recovery" ? "/olvide-contrasena" : "/definir-contrasena";
  url.search = "?aviso=enlace";
  // Si los tokens venían en el #hash, el navegador los conserva y la página los borra.
  return NextResponse.redirect(url);
}
