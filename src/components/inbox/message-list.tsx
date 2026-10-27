"use client";

import { BotIcon, CircleHelpIcon } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EVENT_LABELS, type ContactWithTags, type ConversationEvent, type Message } from "@/lib/crm/types";
import { dayKey, formatDayLabel, formatTime } from "@/lib/format";
import { isMediaKind } from "@/lib/media/rules";
import { cn } from "@/lib/utils";
import { MediaMessage } from "./media/media-message";
import { MessageStatus } from "./message-status";
import { useAgentNames } from "./use-agent-names";

/** Nombre legible de los tipos que el CRM todavía no muestra. */
const UNSUPPORTED_LABELS: Record<string, string> = {
  location: "ubicación",
  contacts: "contacto",
  button: "botón",
  interactive: "respuesta interactiva",
  order: "pedido",
  unsupported: "desconocido",
};

type Props = {
  messages: Message[];
  contact: ContactWithTags | null;
  loading: boolean;
  now: number | null;
  /** Historial de etapas: líneas discretas de sistema entre los mensajes. */
  events?: ConversationEvent[];
};

type TimelineItem = { kind: "message"; time: string; message: Message } | { kind: "event"; time: string; event: ConversationEvent };

/** Mensajes y eventos de etapa en un solo orden cronológico. */
function buildTimeline(messages: Message[], events: ConversationEvent[]): TimelineItem[] {
  const items: TimelineItem[] = messages.map((message) => ({ kind: "message", time: message.wa_timestamp ?? message.created_at, message }));
  if (events.length === 0) return items;
  for (const event of events) items.push({ kind: "event", time: event.created_at, event });
  return items.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Mensajes agrupados por día. Los consecutivos del mismo remitente se agrupan
 * y el avatar del contacto solo aparece en el primero del grupo.
 */
export function MessageList({ messages, contact, loading, now, events = [] }: Props) {
  const agentName = useAgentNames();
  const { profiles } = useCrm();
  const timeline = buildTimeline(messages, events);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const lastIdRef = useRef<string | null>(null);

  // Recordar si el usuario está cerca del final antes de que lleguen mensajes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Bajar al final en la carga inicial, al enviar, o si ya estaba abajo.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const last = messages[messages.length - 1];
    if (!el || !last) return;
    const isNew = last.id !== lastIdRef.current;
    const firstLoad = lastIdRef.current === null;
    lastIdRef.current = last.id;
    if (firstLoad || (isNew && (nearBottomRef.current || last.direction === "outbound"))) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-background px-3 py-4 md:px-6" aria-live="polite">
      {loading && <MessagesSkeleton />}

      {!loading && messages.length === 0 && (
        <EmptyState
          icon="bandeja"
          title="Sin mensajes todavía"
          description="Cuando el cliente escriba, sus mensajes aparecerán aquí."
        />
      )}

      {!loading && messages.length > 0 && (
        <ol className="mx-auto flex max-w-3xl flex-col" aria-label="Mensajes">
          {timeline.map((item, i) => {
            const time = item.time;
            const prev = timeline[i - 1];
            const newDay = !prev || dayKey(prev.time) !== dayKey(time);
            const key = item.kind === "message" ? item.message.id : `e-${item.event.id}`;
            const firstOfGroup =
              item.kind === "message" &&
              (newDay || prev?.kind !== "message" || prev.message.direction !== item.message.direction);
            return (
              <Fragment key={key}>
                {newDay && now !== null && (
                  <li className="sticky top-0 z-10 my-4 flex justify-center">
                    <span className="rounded-full bg-superficie-3 px-4 py-1 text-xs font-medium text-texto-suave shadow-xs">
                      {formatDayLabel(time, now)}
                    </span>
                  </li>
                )}
                {item.kind === "event" ? (
                  <StageEventLine
                    event={item.event}
                    who={item.event.user_id ? profileName(profiles.find((p) => p.id === item.event.user_id)) : "el asistente"}
                  />
                ) : (
                  <MessageBubble
                    message={item.message}
                    time={time}
                    firstOfGroup={firstOfGroup}
                    contact={contact}
                    agentName={item.message.sent_by_agent ? agentName(item.message.agent_id) : null}
                  />
                )}
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Línea de sistema (solo interna): «Pasó a Reparto por Ana · 10:42». */
function StageEventLine({ event, who }: { event: ConversationEvent; who: string }) {
  const label = EVENT_LABELS[event.type] ?? event.type;
  return (
    <li className="my-2 flex justify-center px-6">
      <p className="max-w-full text-center text-xs text-texto-suave">
        <span className="font-medium">{label}</span> por {who} · {formatTime(event.created_at)}
        {event.note && <span className="block text-[0.6875rem] italic">«{event.note}»</span>}
      </p>
    </li>
  );
}

function MessageBubble({
  message,
  time,
  firstOfGroup,
  contact,
  agentName,
}: {
  message: Message;
  time: string;
  firstOfGroup: boolean;
  contact: ContactWithTags | null;
  /** Nombre del asistente si el mensaje lo envió un agente. */
  agentName: string | null;
}) {
  const outbound = message.direction === "outbound";
  const media = isMediaKind(message.type);
  const sticker = message.type === "sticker";
  const unsupported = !media && message.type !== "text";

  const meta = (
    <div
      className={cn(
        "flex items-center justify-end gap-1 text-[0.6875rem] leading-none tabular-nums",
        sticker
          ? "mt-1 rounded-full bg-superficie-3 px-2 py-1 text-texto-suave"
          : outbound
            ? "mt-1 text-burbuja-saliente-texto"
            : "mt-1 text-texto-suave",
      )}
    >
      {agentName && (
        <span className="mr-1 flex max-w-40 items-center gap-0.5 truncate font-medium">
          <BotIcon className="size-3 shrink-0" aria-hidden /> {agentName}
        </span>
      )}
      <time dateTime={time}>{formatTime(time)}</time>
      {outbound && <MessageStatus message={message} />}
    </div>
  );

  return (
    <li className={cn("flex items-end gap-2", outbound ? "justify-end" : "justify-start", firstOfGroup ? "mt-3" : "mt-1")}>
      {/* Avatar solo en el primer mensaje entrante del grupo; hueco en los demás */}
      {!outbound &&
        (firstOfGroup ? (
          <ContactAvatar
            seed={contact?.wa_id ?? message.conversation_id}
            name={contact?.name}
            company={contact?.company}
            size="sm"
            className="self-start"
          />
        ) : (
          <span className="w-8 shrink-0" aria-hidden />
        ))}

      <div className={cn("flex max-w-[80%] flex-col md:max-w-[65%]", outbound ? "items-end" : "items-start")}>
        {sticker ? (
          // Sticker: sin burbuja, tamaño acotado.
          <>
            <MediaMessage message={message} onBrand={false} />
            {meta}
          </>
        ) : (
          <div
            className={cn(
              "rounded-2xl text-[0.9375rem] leading-snug",
              media ? "p-1.5" : "px-3.5 py-2",
              outbound
                ? "bg-burbuja-saliente text-burbuja-saliente-texto"
                : "bg-burbuja-entrante text-burbuja-entrante-texto",
              firstOfGroup && (outbound ? "rounded-tr-md" : "rounded-tl-md"),
            )}
          >
            {media && <MediaMessage message={message} onBrand={outbound} />}
            {unsupported && (
              <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold">
                <CircleHelpIcon className="size-3.5" aria-hidden />
                Mensaje no compatible ({UNSUPPORTED_LABELS[message.type] ?? message.type})
              </p>
            )}
            {/* Texto, leyenda o descripción del tipo no compatible */}
            {message.body && (
              <p className={cn("break-words whitespace-pre-wrap", media && "px-2 pt-1.5")}>{message.body}</p>
            )}
            <div className={cn(media && "px-2 pb-0.5")}>{meta}</div>
          </div>
        )}
        {outbound && message.status === "failed" && (
          <p className="mt-1 text-xs text-error-texto">No se envió{message.error ? `: ${message.error}` : ""}</p>
        )}
      </div>
    </li>
  );
}

function MessagesSkeleton() {
  const rows = [
    { out: false, w: "w-40" },
    { out: false, w: "w-56" },
    { out: true, w: "w-48" },
    { out: false, w: "w-32" },
    { out: true, w: "w-64" },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3" aria-label="Cargando mensajes">
      {rows.map((r, i) => (
        <div key={i} className={cn("flex items-end gap-2", r.out ? "justify-end" : "justify-start")}>
          {!r.out && <Skeleton className="size-8 rounded-full" />}
          <Skeleton className={cn("h-12 rounded-2xl", r.w)} />
        </div>
      ))}
    </div>
  );
}
