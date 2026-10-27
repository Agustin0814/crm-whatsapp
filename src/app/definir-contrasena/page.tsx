"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AuthCard, AuthNotice } from "@/components/auth/auth-card";
import { PasswordFields } from "@/components/settings/password-fields";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { passwordError, updatePasswordErrorMessage } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "inactive";

/**
 * Página que abre el enlace del correo, tanto de invitación como de
 * recuperación. /auth/confirm ya validó el token (o el #hash trae la sesión);
 * aquí se escribe y confirma la contraseña nueva.
 */
export default function SetPasswordPage() {
  return (
    <Suspense fallback={<AuthCard title="Contraseña" subtitle="Comprobando el enlace…"><Skeleton className="h-48 w-full" /></AuthCard>}>
      <SetPassword />
    </Suspense>
  );
}

/** Lee la sesión del #hash (plantilla por defecto de las invitaciones) y lo borra de la URL. */
async function sessionFromHash(supabase: ReturnType<typeof createClient>): Promise<"ok" | "error" | "none"> {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.get("error") || hash.get("error_code")) return "error";
  const access = hash.get("access_token");
  const refresh = hash.get("refresh_token");
  if (!access || !refresh) return "none";
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
  return error ? "error" : "ok";
}

function SetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInvite = searchParams.get("tipo") === "invitacion";
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const fromHash = await sessionFromHash(supabase);
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (fromHash === "error" || !data.user) {
        setStatus("invalid");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
      if (cancelled) return;
      if (!profile?.is_active) {
        await supabase.auth.signOut();
        if (!cancelled) setStatus("inactive");
        return;
      }
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = passwordError(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      setError(updatePasswordErrorMessage(updateError));
      return;
    }
    // Ya tiene sesión: entra directo a la bandeja (el proxy revisa rol y estado).
    router.replace("/");
    router.refresh();
  }

  const title = isInvite ? "Crea tu contraseña" : "Nueva contraseña";
  const subtitle = isInvite ? "Bienvenido al equipo" : "Escribe tu contraseña nueva";

  if (status === "checking") {
    return (
      <AuthCard title={title} subtitle="Comprobando el enlace…">
        <Skeleton className="h-48 w-full" />
      </AuthCard>
    );
  }

  if (status === "invalid" || status === "inactive") {
    return (
      <AuthCard title={title} subtitle={subtitle}>
        <div className="space-y-4">
          <AuthNotice tone="error">
            {status === "inactive"
              ? "Tu cuenta está desactivada. Si crees que es un error, pide ayuda a un administrador."
              : "El enlace no es válido o ya venció. Pide uno nuevo; si era una invitación, pide al administrador que la reenvíe."}
          </AuthNotice>
          <Button asChild variant="outline" className="h-11 w-full">
            <Link href={status === "inactive" ? "/login" : "/olvide-contrasena"}>
              {status === "inactive" ? "Ir a iniciar sesión" : "Pedir un enlace nuevo"}
            </Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordFields
          idPrefix="definir"
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
          invalid={Boolean(error)}
        />
        {error && <AuthNotice tone="error">{error}</AuthNotice>}
        <Button type="submit" className="h-11 w-full text-[0.9375rem]" disabled={saving}>
          {saving && <Loader2Icon className="animate-spin" aria-hidden />}
          {saving ? "Guardando…" : "Guardar y entrar"}
        </Button>
      </form>
    </AuthCard>
  );
}
