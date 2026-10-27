"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { CodeFlow } from "@/components/auth/code-flow";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Activar una cuenta invitada: correo + código de 6 dígitos del correo de
 * invitación y luego la contraseña. Es la dirección que lleva la plantilla
 * «Invite user».
 */
export default function SetPasswordPage() {
  return (
    <AuthCard title="Activa tu cuenta" subtitle="Usa el código de tu correo de invitación">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ActivateAccount />
      </Suspense>
    </AuthCard>
  );
}

function ActivateAccount() {
  const searchParams = useSearchParams();
  // Enlaces de correos anteriores: traen ?aviso=enlace (desde /auth/confirm)
  // o la sesión en el #hash. Ya no se usan: se borra el hash y se avisa.
  const [legacyHash, setLegacyHash] = useState(false);
  useEffect(() => {
    if (!window.location.hash.includes("access_token") && !window.location.hash.includes("error")) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const t = setTimeout(() => setLegacyHash(true), 0);
    return () => clearTimeout(t);
  }, []);
  return <CodeFlow purpose="invite" legacyLink={legacyHash || searchParams.get("aviso") === "enlace"} />;
}
