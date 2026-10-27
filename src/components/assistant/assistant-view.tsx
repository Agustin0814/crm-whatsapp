"use client";

import { ArrowLeftIcon, LockIcon, PencilIcon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { PageHeader } from "@/components/crm/page-header";
import { AssistantSkeleton } from "@/components/crm/section-skeletons";
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
import { SAVED_CHAT_NOTICE } from "@/lib/agents/system-config";
import {
  deleteAssistantChat,
  fetchAssistantChats,
  fetchAssistantTurns,
  renameAssistantChat,
  type AssistantChat,
} from "@/lib/agents/system-client";
import type { StoredTurn } from "@/lib/agents/system-plan";
import { errorMessage } from "@/lib/crm/contacts";
import { formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-provider";
import { AssistantEmptyHint } from "./assistant-empty-hint";
import { AssistantThread } from "./assistant-thread";

const NEW_CHAT = "nuevo";

/**
 * Sección «Asistente»: chats guardados (compartidos con el equipo según el rol
 * mínimo que calculó el servidor), «Nuevo chat», renombrar, borrar y el chat a
 * pantalla completa. `?chat=<id>` o `?chat=nuevo`.
 */
export function AssistantView() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("chat");
  const { me, isAdmin } = useCrm();
  const { availability, ask } = useAssistant();
  const [chats, setChats] = useState<AssistantChat[] | null>(null);
  /** Momento en que se cargó la lista (para «hace 5 min» sin leer el reloj al renderizar). */
  const [listedAt, setListedAt] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [turns, setTurns] = useState<{ chatId: string; turns: StoredTurn[] } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!availability.savedChats) return;
    let cancelled = false;
    fetchAssistantChats(supabase)
      .then((rows) => {
        if (!cancelled) {
          setChats(rows);
          setListedAt(Date.now());
          setListError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) setListError(errorMessage(error, "No se pudieron cargar los chats"));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, availability.savedChats, reload]);

  // Mensajes del chat elegido (RLS: si el rol no alcanza, no llega nada).
  useEffect(() => {
    if (!selected || selected === NEW_CHAT) return;
    let cancelled = false;
    fetchAssistantTurns(supabase, selected)
      .then((rows) => {
        if (!cancelled) setTurns({ chatId: selected, turns: rows });
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo abrir el chat");
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, selected]);

  const refreshList = useCallback(() => setReload((r) => r + 1), []);

  if (availability.loading) return <AssistantSkeleton />;
  if (!availability.available) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="Asistente" />
        <EmptyState icon={SparklesIcon} title="El asistente no está disponible" description="Está apagado o tu rol no puede usarlo. Un administrador lo configura en Agentes." />
      </div>
    );
  }
  if (!availability.savedChats) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="Asistente" />
        <EmptyState icon={SparklesIcon} title="Los chats guardados están desactivados" description="Puedes usar el chat temporal con la burbuja de abajo a la derecha." />
      </div>
    );
  }

  const chat = selected && selected !== NEW_CHAT ? (chats?.find((c) => c.id === selected) ?? null) : null;
  const shownTurns = selected === NEW_CHAT ? [] : turns?.chatId === selected ? turns.turns : null;

  async function onAsk(question: string) {
    setPending(question);
    try {
      if (selected === NEW_CHAT || !selected) {
        const response = await ask(question, { mode: "new" });
        if (response.chatId) {
          setTurns({ chatId: response.chatId, turns: [response.turn] });
          router.replace(`/asistente?chat=${response.chatId}`);
        }
      } else {
        const response = await ask(question, { mode: "saved", id: selected });
        setTurns((prev) => ({ chatId: selected, turns: [...(prev?.chatId === selected ? prev.turns : []), response.turn] }));
      }
      refreshList();
    } finally {
      setPending(null);
    }
  }

  const canEdit = (c: AssistantChat) => c.created_by === me?.id || isAdmin;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Asistente"
        description={SAVED_CHAT_NOTICE}
        actions={
          <Button asChild>
            <Link href={`/asistente?chat=${NEW_CHAT}`}>
              <PlusIcon aria-hidden /> Nuevo chat
            </Link>
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Chats guardados"
          className={cn("min-h-0 w-full overflow-y-auto p-2 lg:block lg:w-(--lista-ancho) lg:shrink-0 lg:border-r", selected ? "hidden" : "block")}
        >
          {listError ? (
            <EmptyState icon={SparklesIcon} tone="error" title="No se pudieron cargar los chats" description={listError} action={<Button onClick={refreshList}>Reintentar</Button>} />
          ) : chats === null ? (
            <p className="px-3 py-2 text-sm text-texto-suave">Cargando…</p>
          ) : chats.length === 0 ? (
            <EmptyState icon={SparklesIcon} title="Aún no hay chats guardados" description="Empieza uno con «Nuevo chat» o guarda el de la burbuja." />
          ) : (
            <ul className="space-y-0.5">
              {chats.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/asistente?chat=${c.id}`}
                    aria-current={c.id === selected ? "page" : undefined}
                    className={cn("block rounded-xl px-3 py-2.5 transition-colors", c.id === selected ? "bg-marca-suave" : "hover:bg-superficie-2")}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{c.title}</span>
                      {c.min_role !== "vendedor" && <LockIcon className="size-3.5 shrink-0 text-texto-suave" aria-label="Solo administradores" />}
                    </span>
                    <span className="text-xs text-texto-suave">{formatRelative(c.updated_at, listedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <section className={cn("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden lg:flex")}>
          {!selected ? (
            <EmptyState icon={SparklesIcon} title="Elige un chat" description="O empieza uno nuevo." className="flex-1" />
          ) : (
            <>
              <ChatHeader chat={chat} isNew={selected === NEW_CHAT} canEdit={chat ? canEdit(chat) : false} onChanged={refreshList} />
              {shownTurns === null ? (
                <p className="px-6 py-4 text-sm text-texto-suave">Cargando…</p>
              ) : (
                <AssistantThread
                  key={selected}
                  turns={shownTurns}
                  pending={pending}
                  onAsk={onAsk}
                  displayName={availability.displayName}
                  emptyHint={<AssistantEmptyHint />}
                  autoFocus
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ChatHeader({ chat, isNew, canEdit, onChanged }: { chat: AssistantChat | null; isNew: boolean; canEdit: boolean; onChanged: () => void }) {
  const supabase = createClient();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat?.title ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!chat || !title.trim()) return;
    try {
      await renameAssistantChat(supabase, chat.id, title);
      setEditing(false);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo renombrar"));
    }
  }

  async function remove() {
    if (!chat) return;
    try {
      await deleteAssistantChat(supabase, chat.id);
      toast.success("Chat borrado");
      onChanged();
      router.replace("/asistente");
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo borrar"));
    }
  }

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b px-2 md:px-4">
      <IconButton label="Volver a la lista" className="lg:hidden" onClick={() => router.push("/asistente")}>
        <ArrowLeftIcon />
      </IconButton>
      {editing && chat ? (
        <form onSubmit={rename} className="flex min-w-0 flex-1 gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} aria-label="Nombre del chat" autoFocus className="h-9" />
          <Button type="submit" size="sm" disabled={!title.trim()}>
            Guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </form>
      ) : (
        <>
          <p className="min-w-0 flex-1 truncate font-semibold">{isNew ? "Nuevo chat" : (chat?.title ?? "Chat")}</p>
          {chat && canEdit && (
            <>
              <IconButton
                label="Renombrar"
                onClick={() => {
                  setTitle(chat.title);
                  setEditing(true);
                }}
              >
                <PencilIcon />
              </IconButton>
              <IconButton label="Borrar chat" onClick={() => setConfirmDelete(true)}>
                <Trash2Icon />
              </IconButton>
            </>
          )}
        </>
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{chat?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>Se borra para todo el equipo. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
