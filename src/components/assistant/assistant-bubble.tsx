"use client";

import { BookmarkPlusIcon, ChevronDownIcon, ChevronLeftIcon, SparklesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SAVED_CHAT_NOTICE, TEMP_CHAT_NOTICE } from "@/lib/agents/system-config";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-provider";
import { AssistantThread } from "./assistant-thread";
import { AssistantEmptyHint } from "./assistant-empty-hint";

/** Margen entre la burbuja y el cuadro de escritura que evita. */
const GAP = 12;
/** Ancho de la columna derecha que ocupa la burbuja (o el panel). */
const BUBBLE_ZONE = 420;

/**
 * Distancia al borde inferior para no tapar el cuadro de escritura ni el botón
 * de enviar: si hay un elemento marcado con `data-assistant-avoid` en la zona
 * derecha, la burbuja se coloca encima. null = posición normal (CSS).
 */
function useAvoidBottom(active: boolean): number | null {
  const [bottom, setBottom] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const observed = new Set<Element>();
    const resize = new ResizeObserver(() => schedule());
    function measure() {
      frame = 0;
      let next: number | null = null;
      for (const el of document.querySelectorAll("[data-assistant-avoid]")) {
        if (!observed.has(el)) {
          observed.add(el);
          resize.observe(el);
        }
        const rect = el.getBoundingClientRect();
        if (rect.height === 0 || rect.right < window.innerWidth - BUBBLE_ZONE) continue;
        next = Math.max(next ?? 0, Math.round(window.innerHeight - rect.top + GAP));
      }
      setBottom(next);
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [active]);
  return active ? bottom : null;
}

/**
 * Burbuja del Asistente del sistema: círculo fijo abajo a la derecha en todas
 * las pantallas (menos /asistente) si el agente está activo y el rol tiene
 * permiso. Abre un chat TEMPORAL compacto.
 */
export function AssistantBubble() {
  const pathname = usePathname();
  const router = useRouter();
  const { availability, temp, askTemp, resetTemp, saveTemp, open, setOpen, minimized, setMinimized } = useAssistant();
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState<null | "form" | "busy">(null);
  const [title, setTitle] = useState("");
  const visible = availability.tempChat && !pathname.startsWith("/asistente");
  const bottom = useAvoidBottom(visible);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!visible) return null;

  // Sin cuadro que evitar: en móvil, encima de la barra inferior; en escritorio, a 20 px.
  const position = bottom === null ? "bottom-[calc(var(--barra-inferior-alto)+env(safe-area-inset-bottom)+12px)] md:bottom-5" : undefined;
  const style = bottom === null ? undefined : { bottom };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className={cn(
          "fixed right-0 z-40 flex h-11 w-7 items-center justify-center rounded-l-xl border border-r-0 bg-background text-marca-texto shadow-md",
          "transition-transform hover:-translate-x-0.5 motion-reduce:transition-none",
          position,
        )}
        style={style}
        aria-label={`Mostrar ${availability.displayName}`}
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
      </button>
    );
  }

  if (!open) {
    return (
      <div className={cn("fixed right-4 z-40 md:right-5", position)} style={style}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex size-12 items-center justify-center rounded-full bg-marca-fuerte text-white shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 motion-reduce:transition-none"
          aria-label={`Abrir ${availability.displayName}`}
        >
          <SparklesIcon className="size-5" aria-hidden />
          {temp.turns.length > 0 && <span className="absolute top-0 right-0 size-3 rounded-full border-2 border-background bg-exito" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-texto-suave shadow-sm hover:text-texto"
          aria-label="Ocultar la burbuja"
        >
          <XIcon className="size-3" aria-hidden />
        </button>
      </div>
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving("busy");
    try {
      const chatId = await saveTemp(title);
      setSaving(null);
      setTitle("");
      setOpen(false);
      toast.success("Chat guardado", { action: { label: "Abrir", onClick: () => router.push(`/asistente?chat=${chatId}`) } });
    } catch (error) {
      setSaving("form");
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el chat");
    }
  }

  return (
    <>
      <section
        aria-label={availability.displayName}
        className={cn(
          "entrada-panel fixed inset-x-2 z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl md:inset-x-auto md:right-5 md:w-[380px]",
          position,
        )}
        style={{ ...style, maxHeight: `calc(100dvh - ${(bottom ?? 80) + 16}px)`, height: 560 }}
      >
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-marca-suave text-marca-texto">
            <SparklesIcon className="size-4" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{availability.displayName}</p>
          {availability.savedChats && temp.turns.length > 0 && (
            <IconButton label="Guardar este chat" size="icon-sm" onClick={() => setSaving(saving ? null : "form")}>
              <BookmarkPlusIcon />
            </IconButton>
          )}
          <IconButton label="Minimizar (el chat se conserva)" size="icon-sm" onClick={() => setOpen(false)}>
            <ChevronDownIcon />
          </IconButton>
          <IconButton
            label="Cerrar y borrar el chat"
            size="icon-sm"
            onClick={() => (temp.turns.length ? setConfirmClose(true) : setOpen(false))}
          >
            <XIcon />
          </IconButton>
        </header>
        {saving && (
          <form onSubmit={onSave} className="space-y-2 border-b bg-superficie px-3 py-2">
            <div className="flex gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                placeholder="Nombre del chat"
                aria-label="Nombre del chat"
                autoFocus
                className="h-8"
              />
              <Button type="submit" size="sm" disabled={saving === "busy" || !title.trim()}>
                Guardar
              </Button>
            </div>
            <p className="text-xs text-texto-suave">{SAVED_CHAT_NOTICE}</p>
          </form>
        )}
        <AssistantThread
          compact
          autoFocus
          turns={temp.turns}
          pending={temp.pending}
          onAsk={askTemp}
          displayName={availability.displayName}
          notice={TEMP_CHAT_NOTICE}
          emptyHint={<AssistantEmptyHint compact />}
        />
        {availability.savedChats && (
          <p className="border-t px-3 py-1.5 text-center text-xs text-texto-suave">
            <Link href="/asistente" className="underline-offset-2 hover:underline" onClick={() => setOpen(false)}>
              Ver chats guardados
            </Link>
          </p>
        )}
      </section>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar y borrar este chat?</AlertDialogTitle>
            <AlertDialogDescription>
              El chat temporal no se guarda. Si quieres conservarlo, guárdalo con un nombre o usa «Minimizar».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir aquí</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetTemp();
                setOpen(false);
              }}
            >
              Cerrar y borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
