import { Icon } from "@/components/ui/icon";
import { avatarColorIndex, avatarFor } from "@/lib/crm/avatar";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: { box: "size-5", text: "text-[0.5625rem]", icon: "size-3", emoji: "text-xs" },
  sm: { box: "size-8", text: "text-xs", icon: "size-4", emoji: "text-base" },
  md: { box: "size-10", text: "text-sm", icon: "size-5", emoji: "text-xl" },
  lg: { box: "size-11", text: "text-sm", icon: "size-5", emoji: "text-xl" },
  xl: { box: "size-18", text: "text-xl", icon: "size-8", emoji: "text-4xl" },
} as const;

type Props = {
  /** Semilla del color: wa_id para contactos, id para usuarios. */
  seed: string;
  name: string | null | undefined;
  company?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * Avatar circular con color estable por contacto (paleta --avatar-1..8, todas
 * con contraste AA para el blanco). El contenido lo decide avatarFor():
 * emoji, icono de empresa, iniciales o icono de persona.
 */
export function ContactAvatar({ seed, name, company, size = "md", className }: Props) {
  const spec = avatarFor({ name, company });
  const s = SIZES[size];

  if (spec.kind === "emoji") {
    // Fondo neutro para que el emoji conserve sus colores.
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-superficie-3 leading-none select-none", s.box, s.emoji, className)}
        aria-hidden
      >
        {spec.emoji}
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none", s.box, s.text, className)}
      style={{ backgroundColor: `var(--avatar-${avatarColorIndex(seed)})` }}
      aria-hidden
    >
      {spec.kind === "initials" ? spec.text : <Icon name={spec.icon} className={s.icon} />}
    </span>
  );
}
