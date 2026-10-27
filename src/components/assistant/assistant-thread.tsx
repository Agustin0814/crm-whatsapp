"use client";

import { BookOpenIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import type { StoredTurn } from "@/lib/agents/system-plan";
import { HELP_TITLES } from "@/lib/help/titles.generated";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-provider";
import { Markdown } from "./markdown";
import { RequestCard } from "./request-card";
import { SimpleChart } from "./simple-chart";

export const QUESTION_MAX = 2000;

type Props = {
  turns: StoredTurn[];
  /** Pregunta en curso (se muestra mientras responde). */
  pending: string | null;
  onAsk: (question: string) => Promise<void>;
  displayName: string;
  /** Aviso fijo arriba (chat temporal o compartido). */
  notice?: ReactNode;
  emptyHint?: ReactNode;
  disabled?: boolean;
  /** Burbuja: textos y márgenes más compactos. */
  compact?: boolean;
  autoFocus?: boolean;
};

/** Hilo de conversación del asistente + cuadro de escritura (burbuja y /asistente). */
export function AssistantThread({ turns, pending, onAsk, displayName, notice, emptyHint, disabled, compact, autoFocus }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = pending !== null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, pending]);

  async function submit() {
    const question = draft.trim();
    if (!question || busy || disabled) return;
    setDraft("");
    setError(null);
    try {
      await onAsk(question);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo enviar la pregunta";
      setError(message);
      setDraft(question); // se devuelve al cuadro para reintentar
      toast.error(message);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "space-y-3 px-3 py-3" : "space-y-4 px-4 py-4 md:px-6")}>
        {notice && <p className="rounded-lg bg-superficie-2 px-3 py-2 text-xs text-texto-suave">{notice}</p>}
        {!turns.length && !pending && emptyHint}
        {turns.map((turn, i) => (
          <Turn key={`${turn.at}-${i}`} turn={turn} displayName={displayName} />
        ))}
        {pending && (
          <>
            <UserBubble text={pending} />
            <div className="flex items-center gap-2 text-sm text-texto-suave" role="status">
              <SparklesIcon className="size-4 text-marca-texto" aria-hidden />
              <span>{displayName} está pensando</span>
              <span className="flex gap-0.5" aria-hidden>
                {[0, 1, 2].map((d) => (
                  <span key={d} className="size-1 animate-bounce rounded-full bg-texto-suave motion-reduce:animate-none" style={{ animationDelay: `${d * 120}ms` }} />
                ))}
              </span>
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>
      <div className={cn("border-t bg-background", compact ? "p-2" : "px-4 py-3 md:px-6")}>
        {error && (
          <p role="alert" className="mb-2 rounded-lg bg-error-suave px-3 py-1.5 text-xs text-error-texto">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-borde-control bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-marca/40">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, QUESTION_MAX))}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={QUESTION_MAX}
            autoFocus={autoFocus}
            disabled={disabled}
            placeholder={`Pregúntale a ${displayName}…`}
            aria-label={`Pregunta para ${displayName}`}
            className="field-sizing-content max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-texto-suave"
          />
          <IconButton
            label="Enviar pregunta"
            size="icon-sm"
            variant="default"
            onClick={() => void submit()}
            disabled={busy || disabled || !draft.trim()}
            className="mb-0.5 rounded-full"
          >
            <Icon name="enviar" className="size-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-marca-suave px-3 py-2 text-sm whitespace-pre-wrap text-texto">{text}</p>
    </div>
  );
}

function Turn({ turn, displayName }: { turn: StoredTurn; displayName: string }) {
  const { requests, ensureRequests } = useAssistant();
  useEffect(() => {
    ensureRequests(turn.requestIds);
  }, [turn.requestIds, ensureRequests]);
  const cited = turn.articles.map((slug) => HELP_TITLES[slug]).filter((t): t is string => !!t);
  return (
    <div className="space-y-2">
      {turn.question && <UserBubble text={turn.question} />}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-texto-suave">
          <SparklesIcon className="size-3.5 text-marca-texto" aria-hidden /> {displayName}
        </p>
        <Markdown text={turn.answer} />
        {turn.chart && <SimpleChart chart={turn.chart} />}
        {turn.requestIds.map((id) => (requests[id] ? <RequestCard key={id} request={requests[id]} /> : null))}
        {cited.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-texto-suave">
            <BookOpenIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>Del manual: {cited.join(", ")}</span>
          </p>
        )}
      </div>
    </div>
  );
}
