import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type Props = {
  /** Icono de marca (nombre) o, si no hay equivalente, uno de lucide-react. */
  icon: IconName | LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Estilo de error (icono y fondo en rojo suave). */
  tone?: "neutral" | "error";
  className?: string;
};

/** Estado vacío o de error con icono, explicación y una acción opcional. */
export function EmptyState({ icon, title, description, action, tone = "neutral", className }: Props) {
  const LucideComp = typeof icon === "string" ? null : icon;
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl",
          tone === "error" ? "bg-error-suave text-error-texto" : "bg-marca-suave text-marca-texto",
        )}
      >
        {typeof icon === "string" ? <Icon name={icon} className="size-7" /> : LucideComp && <LucideComp className="size-7" aria-hidden />}
      </div>
      <div className="max-w-sm space-y-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm text-texto-suave">{description}</p>}
      </div>
      {action}
    </div>
  );
}
