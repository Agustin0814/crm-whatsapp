"use client";

import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { BrandIcon, BrandWordmark } from "@/components/crm/brand-logo";
import { ThemeToggle } from "@/components/crm/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/** Mensaje claro según el error de Supabase Auth (sin detalles técnicos). */
/** false en el servidor y durante la hidratación; true después (sin desajustes). */
const subscribeNoop = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

function loginErrorMessage(error: { status?: number; code?: string; message?: string }): string {
  if (error.code === "invalid_credentials" || error.status === 400) return "Correo o contraseña incorrectos.";
  if (error.code === "email_not_confirmed") return "Tu correo aún no está confirmado. Pide ayuda a un administrador.";
  if (error.status === 429) return "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
  if (!error.status) return "No hay conexión con el servidor. Revisa tu internet.";
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

export default function LoginPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  // El tema solo se conoce en el navegador: el logo se pinta tras hidratar.
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(loginErrorMessage(signInError));
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
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 bg-superficie-2 p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle side="bottom" />
      </div>

      {/* Logo completo según el tema: una sola imagen (se reserva el hueco hasta conocerlo) */}
      <div className="flex h-14 items-center">
        {hydrated && resolvedTheme && <BrandWordmark background={resolvedTheme === "dark" ? "oscuro" : "claro"} className="h-14" />}
      </div>

      <div className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandIcon className="size-10" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Iniciar sesión</h1>
            <p className="text-sm text-texto-suave">Bandeja de WhatsApp Business</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="password">Contraseña</Label>
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

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-error-suave px-3 py-2 text-sm text-error-texto">
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <Button type="submit" className="h-11 w-full text-[0.9375rem]" disabled={loading}>
            {loading && <Loader2Icon className="animate-spin" aria-hidden />}
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </main>
  );
}
