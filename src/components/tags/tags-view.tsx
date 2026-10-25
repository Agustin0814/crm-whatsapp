"use client";

import { PencilIcon, TagsIcon, Trash2Icon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { SectionHeader } from "@/components/settings/section-header";
import { TagChip } from "@/components/crm/tag-chip";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage } from "@/lib/crm/contacts";
import type { Tag } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { TagDialog } from "./tag-dialog";

type TagRow = Tag & { contact_tags: { count: number }[] };

export function TagsView() {
  const supabase = createClient();
  const { isAdmin, reloadTags } = useCrm();
  const [rows, setRows] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ tag: Tag | null; key: number } | null>(null);
  const [deleting, setDeleting] = useState<TagRow | null>(null);

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase.from("tags").select("*, contact_tags(count)").order("name");
    if (error) {
      toast.error("No se pudieron cargar las etiquetas");
      return null;
    }
    return data as unknown as TagRow[];
  }, [supabase]);

  const refresh = useCallback(async () => {
    const data = await fetchRows();
    if (data) setRows(data);
    void reloadTags(); // mantiene al día los selectores del resto de la app
  }, [fetchRows, reloadTags]);

  useEffect(() => {
    let cancelled = false;
    fetchRows().then((data) => {
      if (cancelled) return;
      if (data) setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchRows]);

  async function save(values: { name: string; color: string }): Promise<boolean> {
    const tag = editing?.tag;
    const { error } = tag
      ? await supabase.from("tags").update(values).eq("id", tag.id)
      : await supabase.from("tags").insert(values);
    if (error) {
      toast.error(errorMessage(error, "No se pudo guardar la etiqueta"));
      return false;
    }
    toast.success(tag ? "Etiqueta actualizada" : `Etiqueta «${values.name}» creada`);
    await refresh();
    return true;
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("tags").delete().eq("id", deleting.id);
    if (error) {
      toast.error(errorMessage(error, "No se pudo eliminar la etiqueta"));
    } else {
      toast.success(`Etiqueta «${deleting.name}» eliminada`);
      await refresh();
    }
    setDeleting(null);
  }

  const newButton = (
    <Button onClick={() => setEditing({ tag: null, key: Date.now() })}>
      <Icon name="agregar" /> Nueva etiqueta
    </Button>
  );

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Etiquetas"
        description="Clasifica a tus contactos con etiquetas de colores. Solo un administrador puede eliminarlas."
        actions={newButton}
      />

      <div className="overflow-x-auto rounded-xl border">
        {!loading && rows.length === 0 ? (
          <EmptyState
            icon={TagsIcon}
            title="Aún no hay etiquetas"
            description="Crea etiquetas como «Cliente VIP» o «Seguimiento» y asígnalas desde la ficha del contacto."
            action={newButton}
          />
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Etiqueta</TableHead>
                <TableHead className="hidden sm:table-cell">Color</TableHead>
                <TableHead className="text-right">Contactos</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-4 w-6" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                : rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <TagChip tag={row} />
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                        {row.color}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.contact_tags[0]?.count ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditing({ tag: row, key: Date.now() })}
                            aria-label={`Editar ${row.name}`}
                          >
                            <PencilIcon />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* span: los botones deshabilitados no disparan el tooltip */}
                              <span>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive"
                                  disabled={!isAdmin}
                                  onClick={() => setDeleting(row)}
                                  aria-label={`Eliminar ${row.name}`}
                                >
                                  <Trash2Icon />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{isAdmin ? "Eliminar" : "Solo un administrador puede eliminar etiquetas"}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </div>

      {editing && (
        <TagDialog
          key={editing.key}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          tag={editing.tag}
          onSubmit={save}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{deleting?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará de {deleting?.contact_tags[0]?.count ?? 0} contacto(s). Esta acción no se puede deshacer.
            </AlertDialogDescription>
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
