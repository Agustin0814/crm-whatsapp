"use client";

import { CheckCheckIcon, HandIcon, PhoneIcon, Undo2Icon, TruckIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { profileName, useCrm } from "@/components/crm/crm-provider";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetchContactSummary, type ContactSummaryRow } from "@/lib/agents/client";
import { parseCounters } from "@/lib/agents/notes-plan";
import { STAGE_LABELS, isStage, type ConversationItem, type Stage, type StageAction } from "@/lib/crm/types";
import { formatDateTime, formatPhone, telHref } from "@/lib/format";
import { canCloseDelivery, canMoveToSalesOrDelivery } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type StageActionInput = { action: StageAction; deliveryUserId?: string | null; note?: string | null };

const ALL_DELIVERY = "__todos__";

const STAGE_TONE: Record<Stage, string> = {
  sin_asignar: "bg-superficie-3 text-texto-suave",
  ventas: "bg-marca-suave text-marca-texto",
  reparto: "bg-exito-suave text-exito-texto",
};

/** Etiqueta pequeña de la etapa (lista y encabezado). */
export function StageChip({ stage, className }: { stage: string; className?: string }) {
  if (!isStage(stage)) return null;
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[0.6875rem] font-medium whitespace-nowrap", STAGE_TONE[stage], className)}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

/**
 * Franja bajo el encabezado del chat: etapa actual y sus acciones. Los
 * permisos los vuelve a validar public.change_conversation_stage; aquí solo
 * se muestran los botones que corresponden al rol.
 */
export function StageBar({
  conversation,
  windowOpen,
  onAction,
}: {
  conversation: ConversationItem;
  windowOpen: boolean | null;
  onAction: (input: StageActionInput) => Promise<boolean>;
}) {
  const { role, isDelivery, profiles } = useCrm();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"delivery" | "return" | "delivered" | null>(null);
  const stage = conversation.stage;
  const canMove = canMoveToSalesOrDelivery(role);
  const canClose = canCloseDelivery(role);
  const deliveryUser = conversation.delivery_user_id ? profiles.find((p) => p.id === conversation.delivery_user_id) : null;
  const phone = conversation.contact ? (conversation.contact.wa_id ?? conversation.contact.phone) : null;
  const tel = telHref(phone);

  async function run(input: StageActionInput) {
    setBusy(true);
    const ok = await onAction(input);
    setBusy(false);
    if (ok) setDialog(null);
    return ok;
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2 border-b bg-superficie-2/60 px-3 py-1.5 md:px-4">
      <StageChip stage={stage} />
      {stage === "reparto" && (
        <span className="truncate text-xs text-texto-suave">
          {deliveryUser ? `Para ${profileName(deliveryUser)}` : "Para cualquier repartidor"}
          {conversation.stage_changed_at && ` · desde ${formatDateTime(conversation.stage_changed_at)}`}
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {/* Repartidor con la ventana cerrada: el teléfono a la vista para llamar. */}
        {isDelivery && tel && (
          <Button
            asChild
            size="sm"
            variant={windowOpen === false ? "default" : "outline"}
            className="h-8"
          >
            <a href={tel}>
              <PhoneIcon aria-hidden /> {windowOpen === false ? `Llamar ${formatPhone(phone)}` : "Llamar"}
            </a>
          </Button>
        )}
        {canMove && stage === "sin_asignar" && (
          <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => void run({ action: "take" })}>
            <HandIcon aria-hidden /> Tomar
          </Button>
        )}
        {canMove && stage !== "reparto" && (
          <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => setDialog("delivery")}>
            <TruckIcon aria-hidden /> Pasar a Reparto
          </Button>
        )}
        {canClose && stage === "reparto" && (
          <>
            <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => setDialog("return")}>
              <Undo2Icon aria-hidden /> Devolver a Ventas
            </Button>
            <Button size="sm" className="h-8" disabled={busy} onClick={() => setDialog("delivered")}>
              <CheckCheckIcon aria-hidden /> Marcar entregado
            </Button>
          </>
        )}
        {canClose && stage === "ventas" && (
          <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => setDialog("delivered")}>
            <CheckCheckIcon aria-hidden /> Entregado
          </Button>
        )}
      </div>

      {dialog === "delivery" && (
        <ToDeliveryDialog conversation={conversation} busy={busy} onClose={() => setDialog(null)} onConfirm={run} />
      )}
      {dialog === "return" && <ReturnDialog busy={busy} onClose={() => setDialog(null)} onConfirm={run} />}
      <AlertDialog open={dialog === "delivered"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar como entregado?</AlertDialogTitle>
            <AlertDialogDescription>
              El chat vuelve a «Sin asignar», se quita la asignación y el asistente de respuestas se reanuda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void run({ action: "delivered" })}>
              Marcar entregado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type LastNote = { id: string; body: string; created_at: string };

/**
 * Confirmación de «Pasar a Reparto»: resumen del cliente y últimas notas
 * (dirección, cantidad) para verificar, repartidor opcional y nota.
 */
function ToDeliveryDialog({
  conversation,
  busy,
  onClose,
  onConfirm,
}: {
  conversation: ConversationItem;
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: StageActionInput) => Promise<boolean>;
}) {
  const supabase = createClient();
  const { activeProfiles } = useCrm();
  const deliveryPeople = activeProfiles.filter((p) => p.role === "repartidor");
  const [summary, setSummary] = useState<ContactSummaryRow | null>(null);
  const [notes, setNotes] = useState<LastNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryUserId, setDeliveryUserId] = useState(ALL_DELIVERY);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchContactSummary(supabase, conversation.contact_id).catch(() => null),
      supabase
        .from("notes")
        .select("id, body, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(3)
        .then(({ data }) => data ?? []),
    ]).then(([summaryRow, lastNotes]) => {
      if (cancelled) return;
      setSummary(summaryRow);
      setNotes(lastNotes);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, conversation.id, conversation.contact_id]);

  const counters = summary ? parseCounters(summary.counters) : [];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onConfirm({
      action: "to_delivery",
      deliveryUserId: deliveryUserId === ALL_DELIVERY ? null : deliveryUserId,
      note: note.trim() || null,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Pasar a Reparto</DialogTitle>
            <DialogDescription>
              Verifica los datos antes de enviarlo. El asistente de respuestas se pausa mientras el chat está en reparto.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border bg-superficie-2/60 p-3 text-sm">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-medium text-texto-suave">Resumen del cliente</p>
                  <p className="whitespace-pre-wrap">{summary?.summary?.trim() || "Sin resumen todavía."}</p>
                  {counters.length > 0 && (
                    <p className="mt-1 text-xs text-texto-suave">
                      {counters.map((c) => `${c.item}: ${c.count}`).join(" · ")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-texto-suave">Últimas notas</p>
                  {notes.length === 0 ? (
                    <p className="text-texto-suave">No hay notas en este chat.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {notes.map((n) => (
                        <li key={n.id}>
                          <span className="whitespace-pre-wrap">{n.body}</span>
                          <span className="block text-[0.6875rem] text-texto-suave">{formatDateTime(n.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Repartidor</Label>
            <Select value={deliveryUserId} onValueChange={setDeliveryUserId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL_DELIVERY}>Todos los repartidores</SelectItem>
                {deliveryPeople.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {profileName(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-texto-suave">Si eliges a uno, solo él (y la administración) verá este chat.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reparto-nota">Nota para el reparto (opcional)</Label>
            <Textarea id="reparto-nota" value={note} maxLength={300} rows={2} onChange={(e) => setNote(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || loading}>
              <TruckIcon aria-hidden /> Pasar a Reparto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: StageActionInput) => Promise<boolean>;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onConfirm({ action: "back_to_sales", note: note.trim() || null });
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Devolver a Ventas</DialogTitle>
            <DialogDescription>El chat regresa a Ventas y el asistente de respuestas sigue pausado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="devolver-motivo">Motivo (opcional)</Label>
            <Textarea
              id="devolver-motivo"
              value={note}
              maxLength={300}
              rows={2}
              placeholder="p. ej. No estaba el cliente"
              onChange={(e) => setNote(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              <Undo2Icon aria-hidden /> Devolver a Ventas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
