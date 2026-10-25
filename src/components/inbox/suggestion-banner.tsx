"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { fetchPendingSuggestion, resolveSuggestion } from "@/lib/crm/classification";
import { errorMessage } from "@/lib/crm/contacts";
import type { ClassificationSuggestion } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";

type Props = {
  contactId: string;
  /** Solo se sugiere a contactos «Sin clasificar». */
  classification: string;
  /** Cambia con cada mensaje entrante nuevo: la base pudo crear una sugerencia. */
  refreshKey: string | null;
  /** Tras aceptar o descartar, para recargar la ficha del contacto. */
  onResolved: () => void;
};

/**
 * «Posible prospecto»: la base detecta palabras de intención de compra en los
 * mensajes entrantes y deja una sugerencia pendiente. Nunca se aplica sola: el
 * agente la acepta (pasa a Prospecto) o la descarta.
 */
export function SuggestionBanner({ contactId, classification, refreshKey, onResolved }: Props) {
  const supabase = createClient();
  const [suggestion, setSuggestion] = useState<ClassificationSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const eligible = classification === "unclassified";

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    // El trigger corre en el mismo INSERT del mensaje, así que ya está guardada.
    fetchPendingSuggestion(supabase, contactId)
      .then((s) => {
        if (!cancelled) setSuggestion(s);
      })
      .catch(() => undefined); // un aviso opcional no debe molestar con errores
    return () => {
      cancelled = true;
    };
  }, [supabase, contactId, refreshKey, eligible]);

  if (!eligible || !suggestion || suggestion.contact_id !== contactId) return null;

  async function resolve(accept: boolean) {
    if (!suggestion) return;
    setBusy(true);
    try {
      await resolveSuggestion(supabase, suggestion.id, accept);
      setSuggestion(null);
      toast.success(accept ? "Marcado como prospecto" : "Sugerencia descartada");
      onResolved();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo resolver la sugerencia"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-advertencia-suave px-4 py-2.5 text-sm text-advertencia-texto"
    >
      <Icon name="info" className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Posible prospecto:</span> {suggestion.reason}. ¿Marcar como prospecto?
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void resolve(true)} disabled={busy}>
          Aceptar
        </Button>
        <Button size="sm" variant="outline" onClick={() => void resolve(false)} disabled={busy}>
          Descartar
        </Button>
      </div>
    </div>
  );
}
