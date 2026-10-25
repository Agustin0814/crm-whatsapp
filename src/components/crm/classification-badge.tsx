import { CLASSIFICATION_LABELS, isClassification, type Classification } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

/** Colores por clasificación (tokens de estado; texto con contraste AA). */
export const CLASSIFICATION_STYLES: Record<Classification, string> = {
  unclassified: "bg-superficie-2 text-texto-suave",
  prospect: "bg-advertencia-suave text-advertencia-texto",
  customer: "bg-exito-suave text-exito-texto",
  supplier: "bg-marca-suave text-marca-texto",
};

type Props = {
  classification: string | null | undefined;
  /** Cliente sin compras en el periodo configurado. */
  inactive?: boolean;
  size?: "xs" | "sm";
  className?: string;
};

/** Insignia «Cliente», «Prospecto»… con la marca «Inactivo» opcional. */
export function ClassificationBadge({ classification, inactive = false, size = "sm", className }: Props) {
  const value = isClassification(classification) ? classification : "unclassified";
  const chip = size === "xs" ? "h-5 px-2 text-[0.6875rem]" : "h-6 px-2.5 text-xs";
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn("inline-flex items-center rounded-full font-medium whitespace-nowrap", chip, CLASSIFICATION_STYLES[value])}>
        {CLASSIFICATION_LABELS[value]}
      </span>
      {inactive && (
        <span
          className={cn("inline-flex items-center rounded-full font-medium whitespace-nowrap", chip, "bg-error-suave text-error-texto")}
          title="Sin compras en el periodo de inactividad configurado"
        >
          Inactivo
        </span>
      )}
    </span>
  );
}
