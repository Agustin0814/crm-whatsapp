"use client";

import { BotIcon, CircleHelpIcon } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { EmptyState } from "@/components/crm/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContactWithTags, Message } from "@/lib/crm/types";
import { dayKey, formatDayLabel, formatTime } from "@/lib/format";
import { isMediaKind } from "@/lib/media/rules";
import { cn } from "@/lib/utils";
import { MediaMessage } from "./media/media-message";
import { MessageStatus } from "./message-status";

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
};

/**
 * Mensajes agrupados por día. Los consecutivos del mismo remitente se agrupan
 * y el avatar del contacto solo aparece en el primero del grupo.
 */
export function MessageList({ messages, contact, loading, now }: Props) {
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
          {messages.map((message, i) => {
            const time = message.wa_timestamp ?? message.created_at;
            const prev = messages[i - 1];
            const prevTime = prev ? (prev.wa_timestamp ?? prev.created_at) : null;
            const newDay = !prevTime || dayKey(prevTime) !== dayKey(time);
            const firstOfGroup = newDay || prev?.direction !== message.direction;
            return (
              <Fragment key={message.id}>
                {newDay && now !== null && (
                  <li className="sticky top-0 z-10 my-4 flex justify-center">
                    <span className="rounded-full bg-superficie-3 px-4 py-1 text-xs font-medium text-texto-suave shadow-xs">
                      {formatDayLabel(time, now)}
                    </span>
                  </li>
                )}
                <MessageBubble message={message} time={time} firstOfGroup={firstOfGroup} contact={contact} />
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  time,
  firstOfGroup,
  contact,
}: {
  message: Message;
  time: string;
  firstOfGroup: boolean;
  contact: ContactWithTags | null;
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
      {message.sent_by_agent && (
        <span className="mr-1 flex items-center gap-0.5 font-medium">
          <BotIcon className="size-3" aria-hidden /> Asistente
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
