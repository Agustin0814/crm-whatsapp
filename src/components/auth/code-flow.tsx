"use client";

import { ArrowLeftIcon, Loader2Icon, RotateCwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthNotice } from "@/components/auth/auth-card";
import { PasswordFields } from "@/components/settings/password-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cleanCode, CODE_LENGTH, formatWait, isValidCode, isValidEmail, normalizeEmail, type CodePurpose } from "@/lib/auth-codes";
import { passwordError, updatePasswordErrorMessage } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "code" | "password";

type ApiResult = { ok: true; retryAfter?: number } | { ok: false; error: string; retryAfter?: number };

async function postJson(url: string, body: unknown): Promise<ApiResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; retryAfter?: number };
    if (!response.ok) return { ok: false, error: data.error ?? "Algo salió mal. Inténtalo de nuevo.", retryAfter: data.retryAfter };
    return { ok: true, retryAfter: data.retryAfter };
  } catch {
    return { ok: false, error: "No hay conexión con el servidor. Revisa tu internet." };
  }
}

const SENT_NOTICE = "Si el correo pertenece a una cuenta activa, te enviamos un código de 6 dígitos. Vence en 15 minutos; revisa también la carpeta de spam.";

/**
 * Flujo con código de 6 dígitos por correo, sin enlaces:
 * - recovery: correo → código (con reenvío cada 60 s) → contraseña nueva.
 * - invite: correo + código del correo de invitación → contraseña.
 * La verificación y los límites de intentos viven en /api/auth/*; aquí solo
 * se guarda la contraseña con la sesión que dejó el código.
 */
export function CodeFlow({ purpose, legacyLink }: { purpose: CodePurpose; legacyLink?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(purpose === "recovery" ? "email" : "code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cuenta regresiva del reenvío (el estado cambia solo dentro del timer).
  const counting = cooldown > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  async function sendCode() {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      setError("Escribe un correo válido.");
      return false;
    }
    setLoading(true);
    setError(null);
    const result = await postJson("/api/auth/send-code", { email: normalized });
    setLoading(false);
    if (!result.ok) {
      setError(result.retryAfter ? `${result.error} Podrás pedir otro en ${formatWait(result.retryAfter)}.` : result.error);
      if (result.retryAfter) setCooldown(result.retryAfter);
      return false;
    }
    setNotice(SENT_NOTICE);
    setCooldown(result.retryAfter ?? 60);
    return true;
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await sendCode()) {
      setCode("");
      setStep("code");
    }
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      setError("Escribe un correo válido.");
      return;
    }
    if (!isValidCode(code)) {
      setError(`El código tiene ${CODE_LENGTH} dígitos.`);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await postJson("/api/auth/verify-code", { email: normalized, code, type: purpose });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setCode("");
      return;
    }
    setNotice(null);
    setStep("password");
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = passwordError(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(updatePasswordErrorMessage(updateError));
      return;
    }
    // Cierra las demás sesiones abiertas con la contraseña anterior.
    await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
    // Ya tiene sesión: entra directo (el proxy revisa rol y estado).
    router.replace("/");
    router.refresh();
  }

  const legacyNotice = legacyLink && (
    <AuthNotice tone="error">
      Los enlaces de los correos ya no se usan: ahora el acceso es con un código de 6 dígitos.{" "}
      {purpose === "invite" ? (
        <>
          Si te invitaron, pide al administrador que reenvíe la invitación y escribe aquí el código. Si querías recuperar tu
          contraseña,{" "}
          <Link href="/olvide-contrasena" className="font-medium underline">
            pide un código aquí
          </Link>
          .
        </>
      ) : (
        "Escribe tu correo para recibir un código nuevo."
      )}
    </AuthNotice>
  );

  if (step === "email") {
    return (
      <form onSubmit={handleEmail} className="space-y-4" noValidate>
        {legacyNotice}
        <div className="space-y-2">
          <Label htmlFor="codigo-correo">Correo</Label>
          <Input
            id="codigo-correo"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="h-11"
          />
        </div>
        {error && <AuthNotice tone="error">{error}</AuthNotice>}
        <Button type="submit" className="h-11 w-full text-[0.9375rem]" disabled={loading}>
          {loading && <Loader2Icon className="animate-spin" aria-hidden />}
          {loading ? "Enviando…" : "Enviar código"}
        </Button>
        <div className="flex items-center justify-between gap-2 text-sm">
          <Link href="/login" className="font-medium text-marca-texto hover:underline">
            Volver a iniciar sesión
          </Link>
          <button
            type="button"
            className="font-medium text-marca-texto hover:underline"
            onClick={() => {
              setError(null);
              setStep("code");
            }}
          >
            Ya tengo un código
          </button>
        </div>
      </form>
    );
  }

  if (step === "code") {
    const recovery = purpose === "recovery";
    return (
      <form onSubmit={handleCode} className="space-y-4" noValidate>
        {legacyNotice}
        {notice && <AuthNotice tone="success">{notice}</AuthNotice>}
        {!recovery && (
          <p className="text-sm text-texto-suave">
            Escribe tu correo y el código de 6 dígitos que te llegó en el correo de invitación.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="codigo-correo">Correo</Label>
          <Input
            id="codigo-correo"
            type="email"
            required
            autoComplete="email"
            autoFocus={!recovery || !email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="codigo-digitos">Código de {CODE_LENGTH} dígitos</Label>
          <Input
            id="codigo-digitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern={`\\d{${CODE_LENGTH}}`}
            maxLength={CODE_LENGTH + 4}
            autoFocus={recovery && Boolean(email)}
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            onPaste={(e) => {
              // Al pegar «123 456» o «Código: 123456» se quedan solo los dígitos.
              e.preventDefault();
              setCode(cleanCode(e.clipboardData.getData("text")));
            }}
            aria-invalid={error ? true : undefined}
            className="h-12 text-center font-mono text-2xl tracking-[0.5em] tabular-nums"
            placeholder="••••••"
          />
        </div>
        {error && <AuthNotice tone="error">{error}</AuthNotice>}
        <Button type="submit" className="h-11 w-full text-[0.9375rem]" disabled={loading || code.length !== CODE_LENGTH}>
          {loading && <Loader2Icon className="animate-spin" aria-hidden />}
          {loading ? "Verificando…" : "Verificar código"}
        </Button>

        {recovery ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-marca-texto hover:underline"
              onClick={() => {
                setError(null);
                setNotice(null);
                setStep("email");
              }}
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden /> Cambiar correo
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-marca-texto hover:underline disabled:cursor-not-allowed disabled:text-texto-suave disabled:no-underline"
              disabled={cooldown > 0 || loading || !email}
              onClick={() => void sendCode()}
            >
              <RotateCwIcon className="size-3.5" aria-hidden />
              {cooldown > 0 ? `Reenviar código (${cooldown} s)` : "Reenviar código"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-texto-suave">
            ¿No te llegó o ya venció? Pide al administrador que reenvíe la invitación desde Configuración → Usuarios.
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handlePassword} className="space-y-4" noValidate>
      <AuthNotice tone="success">Código correcto. Ahora crea tu contraseña.</AuthNotice>
      <PasswordFields
        idPrefix="codigo-clave"
        password={password}
        confirm={confirm}
        onPasswordChange={setPassword}
        onConfirmChange={setConfirm}
        invalid={Boolean(error)}
        autoFocus
      />
      {error && <AuthNotice tone="error">{error}</AuthNotice>}
      <Button type="submit" className="h-11 w-full text-[0.9375rem]" disabled={loading || !password}>
        {loading && <Loader2Icon className="animate-spin" aria-hidden />}
        {loading ? "Guardando…" : purpose === "invite" ? "Guardar y entrar" : "Guardar"}
      </Button>
    </form>
  );
}
