"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCompany, type CompanyWithTags } from "@/lib/crm/companies";
import { errorMessage, fetchContact } from "@/lib/crm/contacts";
import { notifyContactsChanged } from "@/lib/crm/purchases";
import type { ContactWithTags } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { CompanyDetails } from "./company-details";
import { ContactDetails } from "./contact-details";

export type PanelTarget = { kind: "person" | "company"; id: string; editar?: boolean };

type Loaded =
  | { kind: "person"; contact: ContactWithTags; conversationId: string | null; inactive: boolean }
  | { kind: "company"; company: CompanyWithTags; inactive: boolean };

/**
 * Ficha de una persona o empresa como panel deslizante sobre /contactos, sin
 * cambiar de página. Reutiliza la MISMA ficha del chat (ContactDetails) y su
 * equivalente de empresa. Con conversación, ofrece «Abrir chat».
 */
export function EntityPanel({ target, onClose }: { target: PanelTarget | null; onClose: () => void }) {
  const supabase = createClient();
  const [loaded, setLoaded] = useState<{ key: string; data: Loaded | null } | null>(null);
  const key = target ? `${target.kind}.${target.id}` : null;
  // Dependencias por valor (el objeto target se recrea en cada render).
  const targetKind = target?.kind;
  const targetId = target?.id;

  useEffect(() => {
    if (!targetKind || !targetId) return;
    let cancelled = false;
    const kind = targetKind;
    const id = targetId;
    const directory = supabase
      .from("contact_directory")
      .select("is_inactive, conversation_id")
      .eq("kind", kind)
      .eq("id", id)
      .maybeSingle();
    const load = async (): Promise<Loaded | null> => {
      const { data: row } = await directory;
      if (kind === "person") {
        const contact = await fetchContact(supabase, id);
        return { kind, contact, conversationId: row?.conversation_id ?? null, inactive: row?.is_inactive === true };
      }
      const company = await fetchCompany(supabase, id);
      return company ? { kind, company, inactive: row?.is_inactive === true } : null;
    };
    load()
      .then((data) => {
        if (!cancelled) setLoaded({ key: `${kind}.${id}`, data });
      })
      .catch((error) => {
        if (cancelled) return;
        // PGRST116 = no existe.
        if ((error as { code?: string }).code !== "PGRST116") toast.error(errorMessage(error, "No se pudo abrir la ficha"));
        setLoaded({ key: `${kind}.${id}`, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, targetKind, targetId]);

  // «Editar ese contacto» (aviso de teléfono repetido): lleva a la sección Datos.
  const ready = loaded !== null && loaded.key === key && loaded.data !== null;
  useEffect(() => {
    if (ready && target?.editar) {
      const t = setTimeout(() => document.getElementById("datos-contacto")?.scrollIntoView({ block: "start" }), 250);
      return () => clearTimeout(t);
    }
  }, [ready, target?.editar]);

  const data = loaded && loaded.key === key ? loaded.data : undefined;

  function update(next: Loaded) {
    setLoaded({ key: key ?? "", data: next });
    notifyContactsChanged(); // la lista y las tarjetas reflejan el cambio
  }

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-(--ficha-ancho)">
        <SheetHeader className="h-16 justify-center border-b px-5">
          <SheetTitle className="text-lg">{target?.kind === "company" ? "Ficha de la empresa" : "Ficha del contacto"}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {data === undefined && (
            <div className="space-y-4" aria-label="Cargando ficha">
              <div className="flex items-center gap-4">
                <Skeleton className="size-18 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          )}
          {data === null && <p className="text-sm text-texto-suave">No se encontró el registro. Puede que se haya eliminado.</p>}
          {data?.kind === "person" && (
            <ContactDetails
              key={data.contact.id}
              contact={data.contact}
              onContactChange={(contact) => update({ ...data, contact })}
              hasConversation={data.conversationId !== null}
              actions={
                data.conversationId ? (
                  <Button size="sm" asChild>
                    <Link href={`/?c=${data.conversationId}`}>
                      <Icon name="bandeja" /> Abrir chat
                    </Link>
                  </Button>
                ) : null
              }
            />
          )}
          {data?.kind === "company" && (
            <CompanyDetails
              key={data.company.id}
              company={data.company}
              inactive={data.inactive}
              onCompanyChange={(company) => update({ ...data, company })}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
