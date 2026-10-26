"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/crm/contacts";
import { CONTACTS_CHANGED_EVENT, fetchContactsSummary, type ContactsSummary } from "@/lib/crm/purchases";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CardTab = "todos" | "clientes" | "empresas";

type Props = {
  /** Pestaña activa del directorio (la tarjeta correspondiente se resalta). */
  activeTab: string;
  onSelect: (tab: CardTab) => void;
};

/** Tarjeta de resumen; mismo alto con o sin datos para no mover la página. */
function Card({
  icon,
  label,
  value,
  hint,
  active,
  onClick,
}: {
  icon: IconName;
  label: string;
  value: number | null;
  hint?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-w-52 shrink-0 snap-start items-center gap-3 rounded-xl border bg-background p-4 text-left transition-colors sm:min-w-0",
        "hover:bg-superficie-2 focus-visible:ring-2 focus-visible:ring-marca focus-visible:outline-none",
        active && "border-marca bg-marca-suave/60 hover:bg-marca-suave",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          active ? "bg-marca text-white" : "bg-marca-suave text-marca-texto",
        )}
        aria-hidden
      >
        <Icon name={icon} className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-texto-suave">{label}</span>
        {value === null ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <span className="block text-2xl leading-tight font-bold tabular-nums">{value}</span>
        )}
        <span className="block h-4 text-xs text-texto-suave">{hint}</span>
      </span>
    </button>
  );
}

/**
 * Totales de /contactos: contactos (personas), clientes (personas y empresas,
 * con los inactivos según el umbral configurado) y empresas. Los cuenta la
 * base (`contacts_summary`, solo conteos). Pulsar una tarjeta filtra la lista.
 */
export function SummaryCards({ activeTab, onSelect }: Props) {
  const supabase = createClient();
  const [summary, setSummary] = useState<ContactsSummary | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchContactsSummary(supabase)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((error) => toast.error(errorMessage(error, "No se pudieron calcular los totales")));
    return () => {
      cancelled = true;
    };
  }, [supabase, version]);

  // Se recalculan al registrar compras, reclasificar o crear contactos.
  useEffect(() => {
    const onChanged = () => setVersion((v) => v + 1);
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged);
  }, []);

  const inactive = summary?.inactive_customers ?? 0;

  return (
    <div
      className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Resumen"
    >
      <Card
        icon="contactos"
        label="Contactos"
        value={summary?.contacts ?? null}
        hint="Personas"
        active={activeTab === "todos"}
        onClick={() => onSelect("todos")}
      />
      <Card
        icon="persona"
        label="Clientes"
        value={summary?.customers ?? null}
        hint={summary ? (inactive > 0 ? `${inactive} ${inactive === 1 ? "inactivo" : "inactivos"}` : "Ninguno inactivo") : null}
        active={activeTab === "clientes"}
        onClick={() => onSelect("clientes")}
      />
      <Card
        icon="empresa"
        label="Empresas"
        value={summary?.companies ?? null}
        active={activeTab === "empresas"}
        onClick={() => onSelect("empresas")}
      />
    </div>
  );
}
