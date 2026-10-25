"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/crm/contacts";
import {
  approveOrder,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  setOrderStatus,
  type OrderWithDetails,
} from "@/lib/crm/orders";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  orders: OrderWithDetails[] | null;
  /** Columna extra: quién lo pidió (empresa) o a qué empresa (empleado). */
  show: "requester" | "company" | "none";
  emptyText: string;
  onChanged: () => void;
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        ORDER_STATUS_STYLES[status] ?? "bg-superficie-2",
      )}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Lista de pedidos con sus líneas, motivos de autorización y acciones. */
export function OrdersList({ orders, show, emptyText, onChanged }: Props) {
  const supabase = createClient();
  const { isAdmin } = useCrm();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [approving, setApproving] = useState<OrderWithDetails | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function changeStatus(order: OrderWithDetails, status: "entregado" | "cancelado") {
    if (status === "cancelado" && !window.confirm(`¿Cancelar el pedido #${order.order_number}? No se puede deshacer.`)) return;
    try {
      await setOrderStatus(supabase, order.id, status);
      toast.success(`Pedido #${order.order_number}: ${ORDER_STATUS_LABELS[status]}`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo cambiar el estado"));
    }
  }

  async function approve() {
    if (!approving || !note.trim()) return;
    setBusy(true);
    try {
      await approveOrder(supabase, approving.id, note);
      toast.success(`Pedido #${approving.order_number} autorizado`);
      setApproving(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo autorizar el pedido"));
    } finally {
      setBusy(false);
    }
  }

  if (orders === null) return <p className="py-6 text-sm text-texto-suave">Cargando pedidos…</p>;
  if (orders.length === 0) return <EmptyState icon="notas" title="Sin pedidos" description={emptyText} />;

  return (
    <>
      <ul className="divide-y rounded-xl border">
        {orders.map((order) => {
          const open = expanded === order.id;
          return (
            <li key={order.id} className="p-3">
              <button
                type="button"
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left"
                onClick={() => setExpanded(open ? null : order.id)}
                aria-expanded={open}
              >
                <span className="font-semibold tabular-nums">#{order.order_number}</span>
                <span className="text-sm text-texto-suave tabular-nums">{formatDate(order.ordered_at)}</span>
                <OrderStatusBadge status={order.status} />
                {order.collect_on_delivery && order.status !== "cancelado" && (
                  <span className="inline-flex h-6 items-center rounded-full bg-marca-suave px-2.5 text-xs font-medium text-marca-texto">
                    Cobrar al entregar
                  </span>
                )}
                <span className="ml-auto font-semibold tabular-nums">{formatMoney(order.total)}</span>
                {show === "requester" && (
                  <span className="w-full text-xs text-texto-suave">Pidió: {order.requester?.name || "Sin nombre"}</span>
                )}
                {show === "company" && order.company && (
                  <span className="w-full text-xs text-texto-suave">A nombre de: {order.company.trade_name}</span>
                )}
              </button>

              {order.status === "pendiente_autorizacion" && order.authorization_reasons.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 rounded-lg bg-advertencia-suave py-2 pr-3 pl-7 text-xs text-advertencia-texto">
                  {order.authorization_reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}

              {open && (
                <div className="mt-3 space-y-3">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-texto-suave">
                      <tr>
                        <th className="text-left font-medium">Descripción</th>
                        <th className="text-right font-medium">Cant.</th>
                        <th className="text-right font-medium">Precio</th>
                        <th className="text-right font-medium">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-0.5">{item.description}</td>
                          <td className="text-right tabular-nums">
                            {Number(item.quantity)} {item.unit}
                          </td>
                          <td className="text-right tabular-nums">{formatMoney(item.unit_price)}</td>
                          <td className="text-right tabular-nums">{formatMoney(item.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {order.notes && <p className="text-sm whitespace-pre-wrap text-texto-suave">{order.notes}</p>}
                  {order.authorization_note && (
                    <p className="text-xs text-texto-suave">Autorizado: {order.authorization_note}</p>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    {isAdmin && order.status === "pendiente_autorizacion" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setNote("");
                          setApproving(order);
                        }}
                      >
                        Autorizar
                      </Button>
                    )}
                    {order.status === "confirmado" && (
                      <Button size="sm" variant="outline" onClick={() => void changeStatus(order, "entregado")}>
                        Marcar entregado
                      </Button>
                    )}
                    {(order.status === "confirmado" || order.status === "pendiente_autorizacion") && (
                      <Button size="sm" variant="ghost" onClick={() => void changeStatus(order, "cancelado")}>
                        Cancelar pedido
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={approving !== null} onOpenChange={(v) => !v && !busy && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorizar pedido #{approving?.order_number}</DialogTitle>
            <DialogDescription>
              Pasa a «Confirmado», suma al saldo y queda registrado con tu nombre y el motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="approve-note">Motivo de la autorización</Label>
            <Textarea
              id="approve-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Ej.: confirmado por teléfono con el dueño"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void approve()} disabled={busy || !note.trim()}>
              {busy ? "Autorizando…" : "Autorizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
