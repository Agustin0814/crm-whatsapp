"use client";

import { BotIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchPendingAgentSuggestion, resolveAgentSuggestion, type AgentSuggestion } from "@/lib/agents/client";
import { createClient } from "@/lib/supabase/client";

type Props = {
  conversationId: string;
  /** false si la ventana de 24 h está cerrada: no se puede enviar texto libre. */
  windowOpen: boolean | null;
};

/**
 * «Sugerencia del asistente» (modo sugerencia o respuesta rápida «con
 * aprobación»): el borrador aparece sobre el composer con Enviar / Editar /
 * Descartar. Llega por Realtime; el envío lo hace el servidor.
 */
export function AgentSuggestionBanner({ conversationId, windowOpen }: Props) {
  const supabase = createClient();
  const [suggestion, setSuggestion] = useState<AgentSuggestion | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchPendingAgentSuggestion(supabase, conversationId)
        .then((s) => {
          if (cancelled) return;
          setSuggestion(s);
          setEditing(false);
        })
        .catch(() => undefined); // un aviso opcional no debe molestar con errores
    void load();

    const channel = supabase
      .channel(`agent-suggestions:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_suggestions", filter: `conversation_id=eq.${conversationId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  if (!suggestion || suggestion.conversation_id !== conversationId) return null;

  async function resolve(action: "send" | "discard") {
    if (!suggestion) return;
    setBusy(true);
    try {
      await resolveAgentSuggestion(suggestion.id, action, editing ? draft : undefined);
      setSuggestion(null);
      setEditing(false);
      if (action === "discard") toast.success("Sugerencia descartada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  }

  const canSend = windowOpen !== false && (!editing || draft.trim() !== "");

  return (
    <div role="status" className="border-t bg-marca-suave px-4 py-3 text-sm">
      <div className="mx-auto max-w-3xl space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-marca-texto">
          <BotIcon className="size-4" aria-hidden /> Sugerencia del asistente
        </p>
        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={4096}
            aria-label="Editar la sugerencia"
            autoFocus
          />
        ) : (
          <p className="rounded-xl bg-background px-3 py-2 whitespace-pre-wrap">{suggestion.body}</p>
        )}
        {windowOpen === false && (
          <p className="text-xs text-advertencia-texto">La ventana de 24 h está cerrada: ya no se puede enviar.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void resolve("send")} disabled={busy || !canSend}>
            Enviar
          </Button>
          {editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
              Cancelar edición
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(suggestion.body);
                setEditing(true);
              }}
              disabled={busy}
            >
              Editar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void resolve("discard")} disabled={busy}>
            Descartar
          </Button>
        </div>
      </div>
    </div>
  );
}
