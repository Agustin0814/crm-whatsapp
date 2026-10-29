"use client";

import { ExternalLinkIcon, MapPinIcon, MegaphoneIcon, SparklesIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/lib/crm/contacts";
import {
  CONTACT_SOURCES,
  formatCoords,
  isContactSource,
  mapsUrlForAddress,
  mapsUrlForCoords,
  SOURCE_LABELS,
} from "@/lib/crm/message-data";
import type { ContactWithTags } from "@/lib/crm/types";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { EditableField } from "./editable-field";

type Suggestion = Pick<Tables<"contact_delivery_suggestions">, "id" | "text">;

const NO_SOURCE = "__sin_origen__";
const COORDS_RE = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** «27.5, -110.9» → coordenadas válidas o null. */
function parseCoordsText(value: string): { lat: number; lng: number } | null {
  const m = COORDS_RE.exec(value);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Enlace a Maps con las coordenadas o, si no hay, con la dirección escrita. */
export function deliveryMapsUrl(contact: Pick<ContactWithTags, "delivery_lat" | "delivery_lng" | "delivery_address">): string | null {
  if (contact.delivery_lat !== null && contact.delivery_lng !== null) return mapsUrlForCoords(contact.delivery_lat, contact.delivery_lng);
  if (contact.delivery_address?.trim()) return mapsUrlForAddress(contact.delivery_address);
  return null;
}

/**
 * Sección «Entrega» de la ficha: dirección, referencias, ubicación (desde una
 * ubicación del chat o escrita como «lat, lng»), origen del contacto y la
 * sugerencia del Asistente de notas. Edita vendedor y administración (RLS).
 */
export function DeliverySection({
  contact,
  onSave,
  onContactChange,
}: {
  contact: ContactWithTags;
  onSave: (patch: TablesUpdate<"contacts">) => Promise<void>;
  onContactChange: (contact: ContactWithTags) => void;
}) {
  const { isSellerOrAdmin } = useCrm();
  const supabase = createClient();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [resolving, setResolving] = useState(false);
  const hasCoords = contact.delivery_lat !== null && contact.delivery_lng !== null;
  const mapsUrl = deliveryMapsUrl(contact);
  const referral = contact.ad_referral && typeof contact.ad_referral === "object" && !Array.isArray(contact.ad_referral)
    ? (contact.ad_referral as Record<string, unknown>)
    : null;

  const loadSuggestion = useCallback(
    () =>
      supabase
        .from("contact_delivery_suggestions")
        .select("id, text")
        .eq("contact_id", contact.id)
        .eq("status", "pending")
        .maybeSingle()
        .then(({ data }) => data),
    [supabase, contact.id],
  );

  useEffect(() => {
    let cancelled = false;
    void loadSuggestion().then((data) => {
      if (!cancelled) setSuggestion(data);
    });
    return () => {
      cancelled = true;
    };
  }, [loadSuggestion]);

  async function resolve(accept: boolean) {
    if (!suggestion) return;
    setResolving(true);
    // «Usar» solo llena la dirección si está vacía (lo garantiza la base).
    const { data, error } = await supabase.rpc("resolve_delivery_suggestion", { p_id: suggestion.id, p_accept: accept });
    setResolving(false);
    if (error) {
      toast.error(errorMessage(error, "No se pudo aplicar la sugerencia"));
      return;
    }
    setSuggestion(null);
    if (accept && data) {
      onContactChange({ ...contact, delivery_address: data.delivery_address });
      toast.success(contact.delivery_address?.trim() ? "Ya había una dirección: no se cambió" : "Dirección guardada");
    }
  }

  return (
    <div className="space-y-4">
      {suggestion && (
        <div className="space-y-2 rounded-lg border border-marca/40 bg-marca-suave/50 p-3 text-sm" role="status">
          <p className="flex items-start gap-1.5">
            <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-marca-texto" aria-hidden />
            <span>
              <span className="font-medium">Sugerido por Notas:</span> {suggestion.text}
            </span>
          </p>
          {isSellerOrAdmin && (
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7" disabled={resolving} onClick={() => void resolve(true)}>
                Usar
              </Button>
              <Button size="sm" variant="ghost" className="h-7" disabled={resolving} onClick={() => void resolve(false)}>
                Descartar
              </Button>
            </div>
          )}
        </div>
      )}

      <EditableField
        icon="ubicacion"
        label="Dirección de entrega"
        multiline
        value={contact.delivery_address}
        placeholder="Calle, número, colonia…"
        onSave={(delivery_address) => onSave({ delivery_address })}
        validate={(v) => (v.length > 500 ? "Máximo 500 caracteres" : null)}
      />
      <EditableField
        icon="info"
        label="Referencias"
        multiline
        value={contact.delivery_references}
        placeholder="Portón verde, junto a la tienda…"
        onSave={(delivery_references) => onSave({ delivery_references })}
        validate={(v) => (v.length > 500 ? "Máximo 500 caracteres" : null)}
      />
      <EditableField
        icon={MapPinIcon}
        label="Ubicación (latitud, longitud)"
        value={hasCoords ? `${contact.delivery_lat}, ${contact.delivery_lng}` : null}
        format={(v) => {
          const c = parseCoordsText(v);
          return c ? formatCoords(c.lat, c.lng) : v;
        }}
        placeholder="O usa una ubicación que mande el cliente"
        onSave={(value) => {
          const c = value ? parseCoordsText(value) : null;
          return onSave({ delivery_lat: c?.lat ?? null, delivery_lng: c?.lng ?? null });
        }}
        validate={(v) => (parseCoordsText(v) ? null : "Escribe «latitud, longitud», p. ej. 27.95, -110.92")}
      />
      {mapsUrl && (
        <div className="flex flex-wrap gap-1.5 pl-8">
          <Button asChild size="sm" variant="outline" className="h-8">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon aria-hidden /> Abrir en Maps
            </a>
          </Button>
          {hasCoords && isSellerOrAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => void onSave({ delivery_lat: null, delivery_lng: null }).catch(() => undefined)}
            >
              <XIcon aria-hidden /> Quitar ubicación
            </Button>
          )}
        </div>
      )}

      <div className="flex items-start gap-3">
        <MegaphoneIcon className="mt-2 size-5 shrink-0 text-texto-suave" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-texto-suave" id={`origen-${contact.id}`}>
            Origen del contacto
          </p>
          <Select
            value={isContactSource(contact.source) ? contact.source : NO_SOURCE}
            disabled={!isSellerOrAdmin}
            onValueChange={(v) => void onSave({ source: v === NO_SOURCE ? null : v }).catch(() => undefined)}
          >
            <SelectTrigger className="h-9 w-full max-w-56" aria-labelledby={`origen-${contact.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={NO_SOURCE}>Sin indicar</SelectItem>
              {CONTACT_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {referral && (
            <p className="text-xs break-words text-texto-suave">
              Llegó por un anuncio
              {typeof referral.headline === "string" && referral.headline ? `: «${referral.headline}»` : ""}
              {contact.ad_referral_at ? ` · ${new Date(contact.ad_referral_at).toLocaleDateString("es-MX")}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
