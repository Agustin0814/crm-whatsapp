"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard, AuthNotice } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Recuperar contraseña" subtitle="Te enviaremos un enlace a tu correo">
      <Suspense fallback={<div className="h-48" />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthCard>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("error") === "enlace";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    expired ? "El enlace no es válido o ya venció. Pide uno nuevo." : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/definir-contrasena`,
    });
    setLoading(false);
    if (resetError?.status === 429) {
      setError("Se enviaron demasiados correos. Espera unos minutos y vuelve a intentarlo.");
      return;
    }
    if (resetError && !resetError.status) {
      setError("No hay conexión con el servidor. Revisa tu internet.");
      return;
    }
    // Mismo mensaje exista o no la cuenta: no se revela qué correos están registrados.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <AuthNotice tone="success">
          Si el correo pertenece a una cuenta activa, te llegará un enlace para crear una contraseña nueva. Revisa también la
          carpeta de spam.
        </AuthNotice>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/login">Volver a iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
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
      {error && <AuthNotice tone="error">{error}</AuthNotice>}
      <Button type="submit" className="h-11 w-full text-[0.9375rem]" disabled={loading}>
        {loading && <Loader2Icon className="animate-spin" aria-hidden />}
        {loading ? "Enviando…" : "Enviar enlace"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-marca-texto hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
