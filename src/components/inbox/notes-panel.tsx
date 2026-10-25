"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { LockIcon, Trash2Icon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/crm/contacts";
import type { NoteWithAuthor } from "@/lib/crm/types";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const NOTE_SELECT = "*, author:profiles(id, full_name)" as const;

/**
 * Notas internas de la conversación (tabla notes). Solo las ve el equipo:
 * se guardan en la base y NUNCA pasan por la API de WhatsApp.
 */
export function NotesPanel({ conversationId }: { conversationId: string }) {
  const supabase = createClient();
  const { me, isAdmin } = useCrm();
  const [notes, setNotes] = useState<NoteWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async (): Promise<NoteWithAuthor[] | null> => {
    const { data, error } = await supabase
      .from("notes")
      .select(NOTE_SELECT)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("No se pudieron cargar las notas");
      return null;
    }
    return data as unknown as NoteWithAuthor[];
  }, [supabase, conversationId]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    const load = () =>
      fetchNotes().then((data) => {
        if (cancelled) return;
        if (data) setNotes(data);
        setLoading(false);
      });
    void load();
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      // Notas de otros agentes en tiempo real (los DELETE no admiten filtro).
      channel = supabase
        .channel(`notes:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notes", filter: `conversation_id=eq.${conversationId}` },
          () => void load(),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notes", filter: `conversation_id=eq.${conversationId}` },
          () => void load(),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, fetchNotes]);

  async function addNote() {
    const body = draft.trim();
    if (!body || !me || saving) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("notes")
      .insert({ conversation_id: conversationId, body, author_id: me.id })
      .select(NOTE_SELECT)
      .single();
    setSaving(false);
    if (error) {
      toast.error(errorMessage(error, "No se pudo guardar la nota"));
      return;
    }
    setDraft("");
    const note = data as unknown as NoteWithAuthor;
    setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]));
  }

  async function deleteNote(id: string) {
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      setNotes(previous);
      toast.error(errorMessage(error, "No se pudo eliminar la nota"));
    } else {
      toast.success("Nota eliminada");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void addNote();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void addNote();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-background px-3 py-4 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {loading && [0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}

          {!loading && notes.length === 0 && (
            <EmptyState
              icon="notas"
              title="Sin notas internas"
              description="Deja contexto para tu equipo: acuerdos, pendientes o datos útiles. El cliente nunca las ve."
            />
          )}

          {notes.map((note) => {
            const canDelete = isAdmin || note.author_id === me?.id;
            return (
              <article key={note.id} className="group rounded-lg border border-nota-borde bg-nota p-3 text-nota-texto">
                <header className="mb-1 flex items-center gap-2 text-xs">
                  <Icon name="notas" className="size-3.5" />
                  <span className="font-semibold">{profileName(note.author)}</span>
                  <time dateTime={note.created_at} className="opacity-80">
                    {formatDateTime(note.created_at)}
                  </time>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="ml-auto text-nota-texto opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => void deleteNote(note.id)}
                      aria-label="Eliminar nota"
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </header>
                <p className="text-sm break-words whitespace-pre-wrap">{note.body}</p>
              </article>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-nota-borde bg-nota/50 p-3 md:px-6">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-nota-texto">
          <LockIcon className="size-3.5" /> Nota interna: solo la ve tu equipo, no se envía por WhatsApp.
        </p>
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Escribe una nota… (Ctrl+Enter para guardar)"
            className="max-h-40 min-h-12 resize-none bg-background"
            aria-label="Nota interna"
          />
          <Button type="submit" variant="secondary" disabled={!draft.trim() || saving}>
            Guardar nota
          </Button>
        </div>
      </form>
    </div>
  );
}
