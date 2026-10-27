"use client";

import { CheckCircle2Icon, Clock3Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { REQUEST_ACTION_LABELS, REQUEST_STATUS_LABELS, resolveAgentRequest, type AgentRequest } from "@/lib/agents/system-client";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-provider";

/**
 * Tarjeta de una tarea pedida a otro agente. Nada se ejecuta hasta que la
 * persona pulsa «Confirmar» (lo valida la base con su sesión). El estado se
 * actualiza en vivo por Realtime («Listo, creé 2 notas…»).
 */
export function RequestCard({ request }: { request: AgentRequest }) {
  const { upsertRequests } = useAssistant();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pending = request.status === "pending_confirmation";
  const expiresIn = Math.max(0, new Date(request.expires_at).getTime() - now);
  const expired = pending && expiresIn === 0;

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  async function resolve(action: "confirm" | "cancel") {
    setBusy(true);
    try {
      upsertRequests([await resolveAgentRequest(request.id, action)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la tarea");
    } finally {
      setBusy(false);
    }
  }

  const labels = REQUEST_ACTION_LABELS[request.action] ?? { agent: "Asistente", action: request.action };
  const contact = (request.params as { contact_name?: string } | null)?.contact_name ?? "Conversación";
  const status = expired ? "expired" : request.status;
  const minutes = Math.floor(expiresIn / 60000);
  const seconds = Math.floor((expiresIn % 60000) / 1000);

  return (
    <div className="space-y-2 rounded-xl border bg-background p-3 text-sm" aria-live="polite">
      <div className="flex items-start gap-2">
        <StatusIcon status={status} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{labels.action}</p>
          <p className="text-xs text-texto-suave">
            {labels.agent} · {contact}
          </p>
        </div>
      </div>
      {request.result && !pending && <p className="text-sm">{request.result}</p>}
      {pending && !expired ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void resolve("confirm")} disabled={busy}>
            Confirmar
          </Button>
          <Button size="sm" variant="outline" onClick={() => void resolve("cancel")} disabled={busy}>
            Cancelar
          </Button>
          <span className="ml-auto text-xs text-texto-suave tabular-nums">
            Caduca en {minutes}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
      ) : (
        <p className={cn("text-xs font-medium", status === "done" ? "text-exito-texto" : status === "failed" ? "text-error-texto" : "text-texto-suave")}>
          {REQUEST_STATUS_LABELS[status] ?? status}
        </p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const base = "mt-0.5 size-4 shrink-0";
  if (status === "done") return <CheckCircle2Icon className={cn(base, "text-exito")} aria-hidden />;
  if (status === "failed" || status === "cancelled" || status === "expired") return <XCircleIcon className={cn(base, "text-texto-suave")} aria-hidden />;
  if (status === "queued" || status === "running") return <Loader2Icon className={cn(base, "animate-spin text-marca-texto motion-reduce:animate-none")} aria-hidden />;
  return <Clock3Icon className={cn(base, "text-marca-texto")} aria-hidden />;
}
