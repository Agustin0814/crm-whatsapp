"use client";

import { BotIcon, PencilIcon, Trash2Icon, ZapIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { SectionHeader } from "@/components/settings/section-header";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isQuickReplyPermission, QUICK_REPLY_PERMISSION_LABELS } from "@/lib/agents/config";
import { errorMessage } from "@/lib/crm/contacts";
import type { QuickReply } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { QuickReplyDialog, type QuickReplyValues } from "./quick-reply-dialog";

export function QuickRepliesView() {
  const supabase = createClient();
  const { isAdmin, isSuperadmin, me, profiles, loading: crmLoading } = useCrm();
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ reply: QuickReply | null; key: number } | null>(null);
  const [deleting, setDeleting] = useState<QuickReply | null>(null);

  const fetchReplies = useCallback(async () => {
    const { data, error } = await supabase.from("quick_replies").select("*").order("shortcut");
    if (error) {
      toast.error("No se pudieron cargar las respuestas rápidas");
      return null;
    }
    return data;
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    fetchReplies().then((data) => {
      if (cancelled) return;
      if (data) setReplies(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchReplies]);

  async function refresh() {
    const data = await fetchReplies();
    if (data) setReplies(data);
  }

  async function save(values: QuickReplyValues): Promise<boolean> {
    const reply = editing?.reply;
    const { error } = reply
      ? await supabase.from("quick_replies").update(values).eq("id", reply.id)
      : await supabase.from("quick_replies").insert({ ...values, created_by: me?.id ?? null });
    if (error) {
      toast.error(errorMessage(error, "No se pudo guardar la respuesta rápida"));
      return false;
    }
    toast.success(reply ? "Respuesta actualizada" : `Respuesta /${values.shortcut} creada`);
    await refresh();
    return true;
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("quick_replies").delete().eq("id", deleting.id);
    if (error) toast.error(errorMessage(error, "No se pudo eliminar"));
    else {
      toast.success(`Respuesta /${deleting.shortcut} eliminada`);
      await refresh();
    }
    setDeleting(null);
  }

  const newButton = isAdmin ? (
    <Button onClick={() => setEditing({ reply: null, key: Date.now() })}>
      <Icon name="agregar" /> Nueva respuesta
    </Button>
  ) : null;

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Respuestas rápidas"
        description="Textos frecuentes que se insertan en el chat escribiendo «/»."
        actions={newButton}
      />

      <div>
        {!crmLoading && !isAdmin && (
          <p className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Icon name="info" className="size-4 shrink-0" />
            Puedes usar estas respuestas en el chat. Solo un administrador puede crearlas o editarlas.
          </p>
        )}

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : replies.length === 0 ? (
          <EmptyState
            icon={ZapIcon}
            title="Aún no hay respuestas rápidas"
            description={
              isAdmin
                ? "Crea respuestas para saludos, horarios o precios y úsalas con «/atajo» en el chat."
                : "Pide a un administrador que cree las respuestas más usadas por el equipo."
            }
            action={newButton}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {replies.map((reply) => {
              const author = profiles.find((p) => p.id === reply.created_by);
              return (
                <Card key={reply.id} className="gap-2 py-4">
                  <CardContent className="flex h-full flex-col gap-2 px-4">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-semibold">/{reply.shortcut}</code>
                      {isAdmin && (
                        <div className="ml-auto flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditing({ reply, key: Date.now() })}
                            aria-label={`Editar /${reply.shortcut}`}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive"
                            onClick={() => setDeleting(reply)}
                            aria-label={`Eliminar /${reply.shortcut}`}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="line-clamp-4 flex-1 text-sm whitespace-pre-wrap text-muted-foreground">{reply.body}</p>
                    {isSuperadmin && reply.agent_permission !== "human_only" && isQuickReplyPermission(reply.agent_permission) && (
                      <Badge variant="secondary" className="w-fit gap-1">
                        <BotIcon aria-hidden /> Asistente: {QUICK_REPLY_PERMISSION_LABELS[reply.agent_permission].toLowerCase()}
                      </Badge>
                    )}
                    {author && <p className="text-xs text-muted-foreground">Creada por {profileName(author)}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <QuickReplyDialog
          key={editing.key}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          reply={editing.reply}
          onSubmit={save}
          showAgentFields={isSuperadmin}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar /{deleting?.shortcut}?</AlertDialogTitle>
            <AlertDialogDescription>El equipo dejará de verla en el chat. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
