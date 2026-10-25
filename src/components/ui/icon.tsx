import { createElement, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import { ICON_DATA, type IconName } from "./icon-data";

export type { IconName };

type Props = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: IconName;
  /** Texto accesible. Sin él, el icono es decorativo (aria-hidden). */
  label?: string;
};

/**
 * Icono de la marca dibujado INLINE con currentColor, para que herede el color
 * del texto y respete el tema. Mismo tamaño (size-4 por defecto) y grosor (2)
 * que los iconos de lucide-react, para que convivan sin desentonar.
 *
 * Los datos salen de public/icons con `npm run iconos`.
 */
export function Icon({ name, label, className, strokeWidth = 2, ...props }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      // shadcn aplica size-4 a los svg sin clase de tamaño dentro de botones.
      className={cn("size-4 shrink-0", className)}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      data-icon={name}
      {...props}
    >
      {ICON_DATA[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
