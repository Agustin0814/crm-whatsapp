"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchLinks, type LinkWithRoles } from "@/lib/crm/companies";
import { errorMessage } from "@/lib/crm/contacts";
import { createOrder, lineTotal, type Order, type OrderLineInput } from "@/lib/crm/orders";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { permissionSummary } from "@/components/contacts/company-links";

export type OrderSource =
  | { kind: "contact"; contactId: string; contactName: string; conversationId?: string | null }
  | { kind: "company"; companyId: string; companyName: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: OrderSource;
  onCreated?: (order: Order) => void;
};

type DraftLine = { description: string; quantity: string; unit: string; unit_price: string };

const EMPTY_LINE: DraftLine = { description: "", quantity: "1", unit: "", unit_price: "" };
const PERSONAL = "__personal__";

function parseLine(line: DraftLine): OrderLineInput | null {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unit_price);
  if (!line.description.trim() || !Number.isFinite(quantity) || quantity <= 0) return null;
  if (line.unit_price.trim() === "" || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  return { description: line.description.trim(), quantity, unit: line.unit.trim(), unit_price: unitPrice };
}

/**
 * Registrar un pedido. Solo se capturan las líneas (sin catálogo de
 * productos): la base calcula el total y decide si queda confirmado o
 * pendiente de autorización, y si se cobra al entregar.
 */
export function OrderDialog({ open, onOpenChange, source, onCreated }: Props) {
  const supabase = createClient();
  const [links, setLinks] = useState<LinkWithRoles[]>([]);
  // Persona: «personal» o id de empresa. Empresa: id del contacto solicitante.
  const [target, setTarget] = useState<string>(source.kind === "contact" ? PERSONAL : "");
  const [lines, setLines] = useState<DraftLine[]>([EMPTY_LINE]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const sourceKey = source.kind === "contact" ? source.contactId : source.companyId;

  // Reinicia el formulario cada vez que se abre (estado derivado, sin efecto).
  const [seenOpen, setSeenOpen] = useState(false);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setTarget(source.kind === "contact" ? PERSONAL : "");
      setLines([EMPTY_LINE]);
      setNotes("");
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const by = source.kind === "contact" ? { contactId: sourceKey } : { companyId: sourceKey };
    fetchLinks(supabase, by)
      .then((rows) => {
        if (!cancelled) setLinks(rows.filter((l) => l.is_active));
      })
      .catch((error) => toast.error(errorMessage(error, "No se pudieron cargar los vínculos")));
    return () => {
      cancelled = true;
    };
  }, [supabase, open, source.kind, sourceKey]);

  const parsed = lines.map(parseLine);
  const valid = parsed.every((l) => l !== null) && parsed.length > 0;
  const total = parsed.reduce((sum, l) => sum + (l ? lineTotal(l) : 0), 0);
  const selectedLink =
    source.kind === "contact"
      ? links.find((l) => l.company_id === target)
      : links.find((l) => l.contact_id === target);
  const needsRequester = source.kind === "company" && !target;

  function patchLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!valid || needsRequester) return;
    setSaving(true);
    try {
      const account =
        source.kind === "company"
          ? ({ kind: "company", id: source.companyId } as const)
          : target === PERSONAL
            ? ({ kind: "contact", id: source.contactId } as const)
            : ({ kind: "company", id: target } as const);
      const requestedBy = source.kind === "company" ? target : source.contactId;
      const order = await createOrder(supabase, {
        account,
        requestedBy,
        conversationId: source.kind === "contact" ? (source.conversationId ?? null) : null,
        items: parsed as OrderLineInput[],
        notes,
      });
      if (order.status === "pendiente_autorizacion") {
        toast.warning(`Pedido #${order.order_number} pendiente de autorización`, {
          description: order.authorization_reasons.join(" · "),
          duration: 10_000,
        });
      } else {
        toast.success(`Pedido #${order.order_number} confirmado por ${formatMoney(order.total)}`, {
          description: order.collect_on_delivery ? "Cobrar al entregar." : "A crédito.",
        });
      }
      onOpenChange(false);
      onCreated?.(order);
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo registrar el pedido"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo pedido</DialogTitle>
          <DialogDescription>
            {source.kind === "contact"
              ? `Solicitado por ${source.contactName}.`
              : `A nombre de ${source.companyName}.`}{" "}
            Sin catálogo: describe cada línea con su cantidad y precio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>{source.kind === "contact" ? "Facturar a" : "Persona que lo solicita"}</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elige a la persona solicitante" />
            </SelectTrigger>
            <SelectContent>
              {source.kind === "contact" && <SelectItem value={PERSONAL}>Compra personal de {source.contactName}</SelectItem>}
              {links.map((l) =>
                source.kind === "contact" ? (
                  <SelectItem key={l.id} value={l.company_id}>
                    Empresa: {l.company?.trade_name ?? "—"}
                  </SelectItem>
                ) : (
                  <SelectItem key={l.id} value={l.contact_id}>
                    {l.contact?.name || "Sin nombre"}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          {source.kind === "company" && links.length === 0 && (
            <p className="text-xs text-advertencia-texto">
              La empresa no tiene personas vinculadas. Vincula a quien hace el pedido en «Contactos vinculados».
            </p>
          )}
          {selectedLink && (
            <p className={selectedLink.can_order ? "text-xs text-texto-suave" : "text-xs text-advertencia-texto"}>
              {permissionSummary(selectedLink)}
              {!selectedLink.can_order && ". El pedido quedará pendiente de autorización."}
            </p>
          )}
          {source.kind === "contact" && target === PERSONAL && (
            <p className="text-xs text-texto-suave">Los pedidos personales siempre se cobran al entregar.</p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-medium">Líneas</legend>
          {lines.map((line, index) => {
            const p = parseLine(line);
            return (
              <div key={index} className="grid grid-cols-6 items-end gap-2 rounded-xl border p-2 sm:grid-cols-12 sm:border-0 sm:p-0">
                <div className="col-span-6 sm:col-span-5">
                  <Label className="sr-only sm:not-sr-only sm:text-xs sm:text-texto-suave" htmlFor={`desc-${index}`}>
                    Descripción
                  </Label>
                  <Input
                    id={`desc-${index}`}
                    placeholder="Ej.: Block 15×20×40"
                    value={line.description}
                    onChange={(e) => patchLine(index, { description: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <Label className="text-xs text-texto-suave" htmlFor={`qty-${index}`}>Cantidad</Label>
                  <Input
                    id={`qty-${index}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={line.quantity}
                    onChange={(e) => patchLine(index, { quantity: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs text-texto-suave" htmlFor={`unit-${index}`}>Unidad</Label>
                  <Input
                    id={`unit-${index}`}
                    placeholder="pza"
                    value={line.unit}
                    onChange={(e) => patchLine(index, { unit: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <Label className="text-xs text-texto-suave" htmlFor={`price-${index}`}>Precio</Label>
                  <Input
                    id={`price-${index}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => patchLine(index, { unit_price: e.target.value })}
                  />
                </div>
                <div className="col-span-5 flex h-9 items-center justify-end text-sm tabular-nums sm:col-span-1">
                  {p ? formatMoney(lineTotal(p)) : "—"}
                </div>
                <div className="col-span-1 flex justify-end">
                  <IconButton
                    label="Quitar línea"
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Icon name="cerrar" className="size-4" />
                  </IconButton>
                </div>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, EMPTY_LINE])}>
            <Icon name="agregar" /> Agregar línea
          </Button>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="order-notes">Notas (opcional)</Label>
          <Textarea
            id="order-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            placeholder="Dirección de entrega, obra, horario…"
          />
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-lg font-semibold tabular-nums">Total {formatMoney(total)}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} disabled={saving || !valid || needsRequester}>
              {saving ? "Registrando…" : "Registrar pedido"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
