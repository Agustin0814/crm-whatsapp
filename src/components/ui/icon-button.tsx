"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof Button>, "children" | "aria-label"> & {
  /** Texto accesible y del tooltip (obligatorio: el botón solo tiene icono). */
  label: string;
  /** Texto del tooltip si debe ser distinto de label (p. ej. «Próximamente»). */
  tooltip?: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
};

/**
 * Botón de solo icono con aria-label, tooltip y anillo de foco visible.
 * Funciona deshabilitado: el tooltip se engancha a un <span> envolvente
 * porque los botones disabled no emiten eventos de puntero.
 */
export function IconButton({
  label,
  tooltip,
  children,
  side = "top",
  variant = "ghost",
  size = "icon",
  className,
  disabled,
  ...props
}: Props) {
  const button = (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      disabled={disabled}
      className={cn("focus-visible:ring-2 focus-visible:ring-marca/60", className)}
      {...props}
    >
      {children}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{disabled ? <span tabIndex={0} className="inline-flex rounded-md">{button}</span> : button}</TooltipTrigger>
      <TooltipContent side={side}>{tooltip ?? label}</TooltipContent>
    </Tooltip>
  );
}
