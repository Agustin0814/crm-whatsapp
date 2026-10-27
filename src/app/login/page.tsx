"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard, AuthNotice } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const INACTIVE_MESSAGE = "Tu cuenta está desactivada. Si crees que es un error, pide ayuda a un administrador.";

/** Mensaje claro según el error de Supabase Auth (sin detalles técnicos). */
function loginErrorMessage(error: { status?: number; code?: string; message?: string }): string {
  if (error.code === "user_banned") return INACTIVE_MESSAGE;
  if (error.code === "invalid_credentials" || error.status === 400) return "Correo o contraseña incorrectos.";
  if (error.code === "email_not_confirmed") return "Tu correo aún no está confirmado. Abre el enlace de tu invitación.";
  if (error.status === 429) return "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
  if (!error.status) return "No hay conexión con el servidor. Revisa tu internet.";
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

export default function LoginPage() {
  return (
    <AuthCard title="Iniciar sesión" subtitle="Bandeja de WhatsApp Business">
      {/* useSearchParams (aviso de cuenta desactivada) va dentro de Suspense */}
      <Suspense fallback={<div className="h-64" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("motivo") === "inactivo" ? INACTIVE_MESSAGE : null,
  );
  const [loading, setLoading] = useState(false);
  const passwordUpdated = searchParams.get("clave") === "actualizada";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(loginErrorMessage(signInError));
        setLoading(false);
        return;
      }
      // Además del bloqueo en Auth, el perfil inactivo no entra (RLS le niega todo igual).
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile?.is_active) {
        await supabase.auth.signOut();
        setError(INACTIVE_MESSAGE);
        setLoading(false);
        return;
      }
    } catch {
      setError("No hay conexión con el servidor. Revisa tu internet.");
      setLoading(false);
      return;
    }

    // refresh() hace que el proxy vea la nueva cookie de sesión.
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {passwordUpdated && !error && <AuthNotice tone="success">Contraseña guardada. Ya puedes entrar.</AuthNotice>}
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Link href="/olvide-contrasena" className="text-sm font-medium text-marca-texto hover:underline">
            ¿La olvidaste?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="h-11"
        />
      </div>

      {error && <AuthNotice tone="error">{error}</AuthNotice>}

      <Button type="submit" className="h-11 w-full text-[0.9375rem]" disabled={loading}>
        {loading && <Loader2Icon className="animate-spin" aria-hidden />}
        {loading ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
