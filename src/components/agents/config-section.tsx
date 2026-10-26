"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sección colapsable del panel de configuración del agente. */
export function ConfigSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="border-b last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-superficie-2"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {description && <p className="text-xs text-texto-suave">{description}</p>}
        </div>
        <ChevronDownIcon
          className={cn("size-4 shrink-0 text-texto-suave transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <div id={id} hidden={!open} className="space-y-4 px-5 pb-5">
        {children}
      </div>
    </section>
  );
}

/** Pista de rango permitido bajo un campo numérico. */
export function RangeHint({ min, max, unit }: { min: number; max: number; unit?: string }) {
  return (
    <p className="text-xs text-texto-suave">
      Permitido: {min}–{max}
      {unit ? ` ${unit}` : ""}
    </p>
  );
}
