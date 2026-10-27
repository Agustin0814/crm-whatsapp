"use client";

import { HistoryIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelBackfill, fetchBackfillStatus, startBackfill, type BackfillStatus } from "@/lib/agents/client";
import { errorMessage } from "@/lib/crm/contacts";
import { createClient } from "@/lib/supabase/client";
import { ConfigSection } from "./config-section";

const numberFmt = new Intl.NumberFormat("es-MX");
/** Cada cuánto se refresca el avance mientras hay chats en cola. */
const POLL_MS = 15_000;

/**
 * «Procesar chats existentes» (capa del proveedor, solo superadmin). La base
 * cuenta sola los chats con mensajes sin procesar y los pone en cola; el motor
 * los procesa por lotes respetando los topes y se detiene si se alcanzan. Es
 * reanudable: cada chat sigue desde su marca de procesado, sin duplicar notas.
 */
export function NotesBackfill({ agentKey }: { agentKey: string }) {
  const supabase = createClient();
  const [status, setStatus] = useState<BackfillStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    () =>
      fetchBackfillStatus(supabase, agentKey).then(
        (s) => {
          setStatus(s);
          setError(null);
        },
        (e: unknown) => setError(errorMessage(e, "No se pudo leer el avance")),
      ),
    [supabase, agentKey],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const queued = status?.queued ?? 0;
  useEffect(() => {
    if (!queued) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [queued, refresh]);

  async function start() {
    setBusy(true);
    try {
      const result = await startBackfill(supabase, agentKey);
      toast.success(
        result.found === 0
          ? "No hay chats pendientes de procesar"
          : `${numberFmt.format(result.queued)} de ${numberFmt.format(result.found)} chats en cola`,
      );
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo iniciar el proceso"));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      const n = await cancelBackfill(supabase, agentKey);
      toast.success(`Proceso detenido (${numberFmt.format(n)} chats salieron de la cola)`);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo detener el proceso"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfigSection title="Procesar chats existentes" description="Resumen y notas para los chats que ya existen, por lotes.">
      {error ? (
        <p role="alert" className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error-texto">
          {error}
        </p>
      ) : (
        <p className="text-sm" aria-live="polite">
          {status === null
            ? "Revisando…"
            : `${numberFmt.format(status.chats_pending)} chats con mensajes sin procesar · ${numberFmt.format(status.queued)} en cola`}
        </p>
      )}
      <p className="text-xs text-texto-suave">
        Respeta el límite diario y el mensual: si se alcanza, se detiene y avisa. Puedes volver a iniciarlo después; sigue donde se quedó y no
        repite notas.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void start()} disabled={busy || status === null || status.chats_pending === 0}>
          <HistoryIcon aria-hidden /> Procesar chats existentes
        </Button>
        {queued > 0 && (
          <Button type="button" variant="ghost" onClick={() => void stop()} disabled={busy}>
            Detener
          </Button>
        )}
      </div>
    </ConfigSection>
  );
}
