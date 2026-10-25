import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import type { Tag } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

type Props = {
  tag: Pick<Tag, "name" | "color">;
  size?: "xs" | "sm";
  /** Punto de color delante del nombre (como en la ficha de la referencia). */
  dot?: boolean;
  onRemove?: () => void;
  className?: string;
};

/**
 * Chip de etiqueta. El color viene de la base (tags.color) y es la única
 * excepción a los tokens. Para que el texto cumpla AA con cualquier color:
 *  - fondo: el color al 14 % (22 % en oscuro) sobre la superficie;
 *  - texto: 35 % del color + 65 % de --etiqueta-texto-base (casi negro en
 *    claro, casi blanco en oscuro), así nunca queda un texto claro sobre claro.
 */
export function TagChip({ tag, size = "sm", dot = false, onRemove, className }: Props) {
  const style = {
    "--tag": tag.color,
    backgroundColor: "color-mix(in oklch, var(--tag) var(--etiqueta-fondo-mezcla), var(--superficie))",
    color: "color-mix(in oklch, var(--tag) 35%, var(--etiqueta-texto-base))",
  } as CSSProperties;

  return (
    <span
      className={cn(
        "inline-flex max-w-40 items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "xs" ? "h-5 px-2 text-[0.6875rem]" : "h-7 px-2.5 text-xs",
        className,
      )}
      style={style}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--tag)" }} />}
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-1 rounded-full p-0.5 opacity-80 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
          aria-label={`Quitar etiqueta ${tag.name}`}
        >
          <Icon name="cerrar" className="size-3" />
        </button>
      )}
    </span>
  );
}
