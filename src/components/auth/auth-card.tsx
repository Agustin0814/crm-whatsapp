import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BrandIcon, ThemedWordmark } from "@/components/crm/brand-logo";
import { ThemeToggle } from "@/components/crm/theme-toggle";
import { cn } from "@/lib/utils";

/** Armazón común de las pantallas de acceso (login, olvidé y definir contraseña). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 bg-superficie-2 p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle side="bottom" />
      </div>

      {/* Logo completo según el tema: las dos versiones en el HTML y el CSS muestra una */}
      <ThemedWordmark className="h-14" />

      <div className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandIcon className="size-10" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-texto-suave">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Aviso de error o de éxito dentro de las tarjetas de acceso. */
export function AuthNotice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const Icon = tone === "error" ? CircleAlertIcon : CircleCheckIcon;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        tone === "error" ? "bg-error-suave text-error-texto" : "bg-exito-suave text-exito-texto",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
