"use client";

import { BotIcon, BotOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { IconButton } from "@/components/ui/icon-button";
import { fetchAgent, setAgentPaused } from "@/lib/agents/client";
import { AGENT_KEYS, pauseReasonLabel } from "@/lib/agents/config";
import type { Conversation } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  conversation: Pick<Conversation, "id" | "agent_paused" | "agent_paused_reason">;
  className?: string;
};

/**
 * Interruptor del asistente en el encabezado del chat. Solo aparece si el
 * asistente está encendido. La pausa también se activa sola cuando una persona
 * escribe o asigna la conversación (triggers de la base).
 */
export function AgentPauseToggle({ conversation, className }: Props) {
  const supabase = createClient();
  const { profiles } = useCrm();
  const [enabled, setEnabled] = useState(false);
  const [optimistic, setOptimistic] = useState<{ id: string; paused: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAgent(supabase, AGENT_KEYS.responder)
      .then((agent) => {
        if (!cancelled) setEnabled(agent?.enabled ?? false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (!enabled) return null;

  // El valor optimista solo vale para esta conversación y hasta que llegue el real.
  const paused =
    optimistic && optimistic.id === conversation.id && optimistic.paused !== conversation.agent_paused
      ? optimistic.paused
      : conversation.agent_paused;
  const reason = pauseReasonLabel(conversation.agent_paused_reason, (id) => profileName(profiles.find((p) => p.id === id)));

  async function toggle() {
    const next = !paused;
    setOptimistic({ id: conversation.id, paused: next });
    setBusy(true);
    try {
      await setAgentPaused(supabase, conversation.id, next);
      toast.success(next ? "Asistente pausado en este chat" : "Asistente reanudado en este chat");
    } catch {
      setOptimistic(null);
      toast.error("No se pudo cambiar el asistente");
    } finally {
      setBusy(false);
    }
  }

  return (
    <IconButton
      label={paused ? "Reanudar el asistente en este chat" : "Pausar el asistente en este chat"}
      tooltip={paused ? `Asistente en pausa${reason ? ` (${reason.toLowerCase()})` : ""}. Clic para reanudar` : "Asistente activo. Clic para pausar"}
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={!paused}
      className={cn(paused ? "text-texto-suave" : "bg-marca-suave text-marca-texto", className)}
    >
      {paused ? <BotOffIcon className="size-5" aria-hidden /> : <BotIcon className="size-5" aria-hidden />}
    </IconButton>
  );
}
