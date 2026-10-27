"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { CodeFlow } from "@/components/auth/code-flow";
import { Skeleton } from "@/components/ui/skeleton";

/** Recuperar contraseña con un código de 6 dígitos (correo → código → contraseña nueva). */
export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Recuperar contraseña" subtitle="Te enviaremos un código a tu correo">
      {/* useSearchParams (aviso de enlace antiguo) va dentro de Suspense */}
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <ForgotPassword />
      </Suspense>
    </AuthCard>
  );
}

function ForgotPassword() {
  const searchParams = useSearchParams();
  return <CodeFlow purpose="recovery" legacyLink={searchParams.get("aviso") === "enlace"} />;
}
