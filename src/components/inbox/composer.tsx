"use client";

import { LockIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { applyTemplate } from "@/lib/crm/templates";
import type { ContactWithTags, Message, QuickReply } from "@/lib/crm/types";
import { formatRemaining } from "@/lib/format";
import { SEND_RULES } from "@/lib/media/rules";
import { UploadAbortedError, uploadOutboundFile, validateFile } from "@/lib/media/upload";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./emoji-picker";
import { AttachmentPreview, type Attachment } from "./media/attachment-preview";

const MAX_TEXT_LENGTH = 4096;
const MAX_SUGGESTIONS = 8;
/** Chips de respuestas rápidas visibles sobre el campo. */
const QUICK_CHIPS = 4;

/** Tipos que ofrece el selector de archivos (se valida el tipo real después). */
const ACCEPT = [
  ...new Set(Object.values(SEND_RULES).flatMap((r) => r.mimes)),
  ".jpg,.jpeg,.png,.webp,.mp3,.m4a,.aac,.amr,.ogg,.opus,.mp4,.3gp,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
].join(",");

/** Lo que el chat puede pedirle al campo de escritura (arrastrar y soltar). */
export type ComposerHandle = { attachFile: (file: File) => void };

type Props = {
  conversationId: string;
  contact: ContactWithTags | null;
  /** null mientras no se conoce la hora (primer render). */
  windowOpen: boolean | null;
  /** Milisegundos que le quedan a la ventana de 24 h. */
  remainingMs: number;
  /** El cliente escribió alguna vez (para el texto del aviso). */
  hasInbound: boolean;
  onSent: (message: Message) => void;
  ref?: Ref<ComposerHandle>;
};

/** Token "/atajo" justo antes del cursor, o null. */
function slashTokenAt(text: string, caret: number): { start: number; query: string } | null {
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[1].length - 1, query: match[1].toLowerCase() };
}

/**
 * Zona de escritura: aviso de la ventana de 24 h, chips de respuestas rápidas,
 * campo con emoji / adjuntar y botón de envío. Escribir "/" abre el menú de
 * respuestas rápidas. Enter envía; Shift+Enter hace salto de línea.
 */
export function Composer({ conversationId, contact, windowOpen, remainingMs, hasInbound, onSent, ref }: Props) {
  const supabase = createClient();
  const { me } = useCrm();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  /** Progreso de subida (0..1) mientras se envía un archivo. */
  const [progress, setProgress] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [slash, setSlash] = useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const locked = windowOpen === false;
  const captionAllowed = attachment ? SEND_RULES[attachment.kind].caption : true;

  // Libera la vista previa local cuando cambia o se quita el adjunto.
  useEffect(() => {
    const url = attachment?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment]);

  /** Valida (tipo real y tamaño) y prepara el archivo para enviarlo. */
  async function attachFile(file: File) {
    if (locked || sending) return;
    const result = await validateFile(file);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const previewUrl = ["image", "sticker", "video"].includes(result.kind) ? URL.createObjectURL(file) : null;
    setAttachment({ file, kind: result.kind, mime: result.mime, previewUrl });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  useImperativeHandle(ref, () => ({ attachFile: (file: File) => void attachFile(file) }));

  function removeAttachment() {
    abortRef.current?.abort(); // cancela la subida si estaba en curso
    setAttachment(null);
    setProgress(null);
  }

  /** Pegar imágenes con Ctrl+V. */
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(event.clipboardData.files)[0];
    if (!file) return; // texto normal: se pega como siempre
    event.preventDefault();
    void attachFile(file);
  }

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("quick_replies")
      .select("*")
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled && data) setReplies(data);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const suggestions = slash
    ? replies
        .filter((r) => r.shortcut.toLowerCase().includes(slash.query) || r.body.toLowerCase().includes(slash.query))
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const menuOpen = slash !== null && !locked;

  function updateSlash(value: string, caret: number) {
    setSlash(slashTokenAt(value, caret));
    setHighlight(0);
  }

  /** Inserta texto en la posición del cursor (reemplaza la selección o un rango dado). */
  function insertAt(content: string, from?: number) {
    const el = textareaRef.current;
    const start = from ?? el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + content + text.slice(Math.max(start, end))).slice(0, MAX_TEXT_LENGTH);
    setText(next);
    setSlash(null);
    const position = Math.min(start + content.length, next.length);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(position, position);
    });
  }

  // Respuestas rápidas usadas en el borrador: el servidor comprueba que el rol
  // de quien escribe pueda usarlas (quick_replies.visible_para, por RLS).
  const usedRepliesRef = useRef(new Set<string>());

  function insertReply(reply: QuickReply, fromSlash: boolean) {
    usedRepliesRef.current.add(reply.id);
    insertAt(applyTemplate(reply.body, contact), fromSlash && slash ? slash.start : undefined);
  }

  async function sendAttachment(current: Attachment) {
    if (!me) return;
    setSending(true);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // 1. Subida directa a Storage (no pasa por Next/Vercel).
      const path = await uploadOutboundFile(supabase, me.id, current.file, current.mime, setProgress, controller.signal);
      // 2. El servidor valida, lo sube a Meta y envía el mensaje.
      const response = await fetch("/api/whatsapp/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          path,
          caption: captionAllowed ? text.trim() : "",
          filename: current.file.name,
        }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as { message?: Message; error?: string };
      if (!response.ok || !data.message) {
        toast.error(data.error ?? "No se pudo enviar el archivo");
        return;
      }
      setText("");
      setAttachment(null);
      onSent(data.message);
    } catch (error) {
      if (error instanceof UploadAbortedError || controller.signal.aborted) return;
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el archivo");
    } finally {
      abortRef.current = null;
      setProgress(null);
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  async function send() {
    if (locked || sending) return;
    if (attachment) {
      await sendAttachment(attachment);
      return;
    }
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text: body, quickReplyIds: [...usedRepliesRef.current] }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: Message; error?: string };
      if (!response.ok || !data.message) {
        toast.error(data.error ?? "No se pudo enviar el mensaje");
        return;
      }
      setText("");
      usedRepliesRef.current.clear();
      onSent(data.message);
    } catch {
      toast.error("Error de red al enviar el mensaje");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOpen && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertReply(suggestions[highlight], true);
        return;
      }
    }
    if (menuOpen && event.key === "Escape") {
      event.preventDefault();
      setSlash(null);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-3 border-t bg-background px-3 pt-3 pb-3 md:px-6">
      {/* --- Aviso de la ventana de 24 h ----------------------------------- */}
      {windowOpen === true && (
        <div className="flex items-center gap-2 rounded-lg bg-exito-suave px-3 py-2 text-sm text-exito-texto" role="status">
          <Icon name="ventana" className="size-4" />
          <span>Ventana de WhatsApp: {formatRemaining(remainingMs)}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="rounded-full p-0.5" aria-label="Qué es la ventana de 24 horas">
                <Icon name="info" className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72 text-pretty">
              WhatsApp solo permite escribir libremente durante las 24 horas posteriores al último mensaje del
              cliente. Después, únicamente se puede enviar una plantilla aprobada por Meta.
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      {locked && (
        <div
          className="flex items-start gap-3 rounded-lg border border-advertencia/40 bg-advertencia-suave p-3 text-sm text-advertencia-texto"
          role="status"
        >
          <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">La ventana de 24 h está cerrada</p>
            <p>
              {hasInbound ? "Pasaron más de 24 h desde el último mensaje del cliente" : "El cliente aún no ha escrito"}.
              Solo puedes contactarlo con una plantilla aprobada por Meta; el texto libre está bloqueado.
            </p>
          </div>
        </div>
      )}

      {/* --- Chips de respuestas rápidas ----------------------------------- */}
      {replies.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Respuestas rápidas">
          {replies.slice(0, QUICK_CHIPS).map((reply) => (
            <button
              key={reply.id}
              type="button"
              disabled={locked}
              onClick={() => insertReply(reply, false)}
              title={applyTemplate(reply.body, contact)}
              className="h-9 shrink-0 rounded-full border border-borde-control bg-background px-4 text-sm font-medium capitalize hover:border-marca hover:text-marca-texto disabled:pointer-events-none disabled:opacity-50"
            >
              {reply.shortcut.replace(/[-_]+/g, " ")}
            </button>
          ))}
        </div>
      )}

      {/* --- Menú "/" ------------------------------------------------------- */}
      {menuOpen && (
        <div
          className="absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg md:inset-x-6"
          role="listbox"
          aria-label="Respuestas rápidas"
        >
          <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-texto-suave">
            <ZapIcon className="size-3.5" aria-hidden /> Respuestas rápidas
            <span className="ml-auto hidden sm:inline">↑↓ para moverte · Enter para insertar · Esc para cerrar</span>
          </div>
          {suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-texto-suave">
              {replies.length === 0 ? (
                <>
                  Aún no hay respuestas rápidas.{" "}
                  <Link
                    href="/configuracion?tab=respuestas-rapidas"
                    className="text-marca-texto underline-offset-4 hover:underline"
                  >
                    Crear una
                  </Link>
                </>
              ) : (
                "Ningún atajo coincide."
              )}
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {suggestions.map((reply, i) => (
                <li key={reply.id} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    // onMouseDown para no perder el foco del textarea
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertReply(reply, true);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left",
                      i === highlight && "bg-marca-suave",
                    )}
                  >
                    <span className="font-mono text-xs font-semibold text-marca-texto">/{reply.shortcut}</span>
                    <span className="line-clamp-2 text-sm text-texto-suave">{applyTemplate(reply.body, contact)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* --- Archivo elegido ------------------------------------------------- */}
      {attachment && <AttachmentPreview attachment={attachment} progress={progress} onRemove={removeAttachment} />}

      {/* --- Campo de texto -------------------------------------------------- */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // permite volver a elegir el mismo archivo
          if (file) void attachFile(file);
        }}
      />
      <div className="flex items-end gap-2">
        <div
          className={cn(
            "flex min-h-12 flex-1 items-end gap-1 rounded-2xl border border-borde-control bg-background px-1.5 py-1 transition-colors focus-within:border-marca",
            locked && "bg-superficie-2",
          )}
        >
          <EmojiPicker disabled={locked || sending} onSelect={(emoji) => insertAt(emoji)} />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              updateSlash(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={handleKeyDown}
            onClick={(e) => updateSlash(text, e.currentTarget.selectionStart)}
            onBlur={() => setSlash(null)}
            onPaste={handlePaste}
            rows={1}
            maxLength={attachment ? 1024 : MAX_TEXT_LENGTH}
            disabled={locked || sending || !captionAllowed}
            placeholder={
              locked
                ? "Texto libre bloqueado: ventana de 24 h cerrada"
                : attachment
                  ? captionAllowed
                    ? "Añade una leyenda (opcional)…"
                    : "Este tipo de archivo se envía sin leyenda"
                  : "Escribe un mensaje…"
            }
            className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-[0.9375rem] outline-none placeholder:text-texto-suave focus-visible:outline-none disabled:cursor-not-allowed"
            aria-label="Mensaje"
          />
          <IconButton
            label="Adjuntar archivo"
            tooltip="Adjuntar imagen, audio, video, documento o sticker"
            disabled={locked || sending}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 text-texto-suave hover:text-texto"
          >
            <Icon name="adjuntar" className="size-5" />
          </IconButton>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="submit"
              disabled={locked || sending || (!text.trim() && !attachment)}
              aria-label="Enviar mensaje"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-marca text-white shadow-sm transition-colors hover:bg-marca-fuerte disabled:pointer-events-none disabled:opacity-50"
            >
              <Icon name="enviar" className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Enviar (Enter)</TooltipContent>
        </Tooltip>
      </div>
    </form>
  );
}
