"use client";

import { ExternalLinkIcon, MapPinIcon, PhoneIcon, UserCheckIcon, UserPlusIcon, UserRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/crm/contacts";
import {
  formatCoords,
  mapsUrlForCoords,
  type MessageLocation,
  type SharedContact,
} from "@/lib/crm/message-data";
import { createPerson, findPhoneMatches, isSearchablePhone, type PhoneMatch } from "@/lib/crm/phones";
import { formatPhone, telHref } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Ubicación compartida por el cliente: nombre o dirección, coordenadas,
 * «Abrir en Maps» (enlace, sin mapas ni claves) y, para vendedor y
 * administración, «Usar como ubicación de entrega».
 */
export function LocationCard({
  messageId,
  location,
  onContactChanged,
}: {
  messageId: string;
  location: MessageLocation;
  onContactChanged?: () => void;
}) {
  const { isSellerOrAdmin } = useCrm();
  const [saving, setSaving] = useState(false);
  const title = location.name ?? location.address ?? "Ubicación compartida";

  async function saveAsDelivery() {
    setSaving(true);
    // La base valida rol, acceso al chat y coordenadas; la dirección solo se llena si estaba vacía.
    const { error } = await createClient().rpc("set_delivery_location_from_message", { p_message_id: messageId });
    setSaving(false);
    if (error) {
      toast.error(errorMessage(error, "No se pudo guardar la ubicación"));
      return;
    }
    toast.success("Ubicación de entrega guardada en el contacto");
    onContactChanged?.();
  }

  return (
    <div className="mb-1 w-64 max-w-full space-y-2 rounded-xl border border-borde bg-background/70 p-3 text-texto">
      <div className="flex items-start gap-2">
        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-marca-texto" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm leading-tight font-semibold break-words">{title}</p>
          {location.name && location.address && <p className="text-xs break-words text-texto-suave">{location.address}</p>}
          <p className="text-xs text-texto-suave tabular-nums">{formatCoords(location.latitude, location.longitude)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button asChild size="sm" variant="outline" className="h-8">
          <a href={mapsUrlForCoords(location.latitude, location.longitude)} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon aria-hidden /> Abrir en Maps
          </a>
        </Button>
        {isSellerOrAdmin && (
          <Button size="sm" variant="ghost" className="h-8" disabled={saving} onClick={() => void saveAsDelivery()}>
            <MapPinIcon aria-hidden /> Usar como ubicación de entrega
          </Button>
        )}
      </div>
    </div>
  );
}

/** Contacto(s) compartido(s): nombre, teléfono y «Crear contacto» si no existe (vendedor y administración). */
export function SharedContactsCard({ contacts }: { contacts: SharedContact[] }) {
  return (
    <div className="mb-1 w-64 max-w-full space-y-2">
      {contacts.map((c, i) => (
        <SharedContactItem key={i} contact={c} />
      ))}
    </div>
  );
}

function SharedContactItem({ contact }: { contact: SharedContact }) {
  const { isSellerOrAdmin } = useCrm();
  const phone = contact.phones[0]?.wa_id ?? contact.phones[0]?.phone ?? "";
  const searchable = isSearchablePhone(phone);
  const [existing, setExisting] = useState<PhoneMatch | null>(null);
  const [checked, setChecked] = useState(false);
  const [creating, setCreating] = useState(false);
  const tel = telHref(phone);

  useEffect(() => {
    if (!isSellerOrAdmin || !searchable) return;
    let cancelled = false;
    findPhoneMatches(createClient(), phone)
      .then((matches) => {
        if (cancelled) return;
        setExisting(matches.find((m) => m.kind === "person") ?? null);
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isSellerOrAdmin, searchable, phone]);

  async function create() {
    setCreating(true);
    const supabase = createClient();
    try {
      // Una empresa con el mismo número no impide crear a la persona: se confirma aquí.
      const matches = await findPhoneMatches(supabase, phone);
      const result = await createPerson(
        supabase,
        { name: contact.name || formatPhone(phone), phone, email: "" },
        matches,
        { mode: "anyway" },
      );
      if (result.status === "created") toast.success(`Contacto «${contact.name || formatPhone(phone)}» creado`);
      else if (result.status === "blocked") toast.error(`Este número ya está registrado como ${result.match.name}`);
      else toast.error("No se pudo crear el contacto");
      setExisting(
        result.status === "created"
          ? { kind: "person", id: result.id, name: contact.name, classification: "unclassified", has_conversation: false, is_linked: false }
          : result.status === "blocked"
            ? result.match
            : null,
      );
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo crear el contacto"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-borde bg-background/70 p-3 text-texto">
      <div className="flex items-start gap-2">
        <UserRoundIcon className="mt-0.5 size-4 shrink-0 text-marca-texto" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm leading-tight font-semibold break-words">{contact.name || "Contacto compartido"}</p>
          {contact.phones.map((p, i) => (
            <p key={i} className="text-xs text-texto-suave tabular-nums">
              {formatPhone(p.wa_id ?? p.phone)}
            </p>
          ))}
        </div>
      </div>
      <div className={cn("flex flex-wrap items-center gap-1.5", !tel && !isSellerOrAdmin && "hidden")}>
        {tel && (
          <Button asChild size="sm" variant="outline" className="h-8">
            <a href={tel}>
              <PhoneIcon aria-hidden /> Llamar
            </a>
          </Button>
        )}
        {isSellerOrAdmin && searchable && checked && !existing && (
          <Button size="sm" variant="ghost" className="h-8" disabled={creating} onClick={() => void create()}>
            <UserPlusIcon aria-hidden /> Crear contacto
          </Button>
        )}
        {isSellerOrAdmin && existing && (
          <span className="inline-flex items-center gap-1 text-xs text-texto-suave">
            <UserCheckIcon className="size-3.5" aria-hidden /> Ya está en contactos{existing.name ? `: ${existing.name}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
