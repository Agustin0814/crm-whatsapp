"use client";

import { useState } from "react";
import { toast } from "sonner";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/crm/contacts";
import {
  createInvoice,
  createPayment,
  INVOICE_FILE_MAX_BYTES,
  INVOICE_FILE_TYPES,
  INVOICE_STATUS_LABELS,
  invoiceFileUrl,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  setInvoiceStatus,
  type Account,
  type Invoice,
  type OrderWithDetails,
  type Payment,
} from "@/lib/crm/orders";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Props = {
  account: Account;
  payments: Payment[] | null;
  invoices: Invoice[] | null;
  /** Pedidos de la cuenta para relacionar un pago o factura (opcional). */
  orders: OrderWithDetails[];
  onChanged: () => void;
};

const NO_ORDER = "__sin_pedido__";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseAmount(value: string): number | null {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Pagos (abonos) y facturas de una cuenta. Cualquiera registra; corregir o
 * borrar un pago y cambiar el estado de una factura es solo de administrador.
 * Las facturas son un registro administrativo (sin timbrado CFDI).
 */
export function PaymentsInvoices({ account, payments, invoices, orders, onChanged }: Props) {
  const supabase = createClient();
  const { me, isAdmin, profiles } = useCrm();
  const [dialog, setDialog] = useState<"payment" | "invoice" | null>(null);
  const [busy, setBusy] = useState(false);

  // Formulario compartido (se reinicia al abrir cada diálogo).
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("transferencia");
  const [date, setDate] = useState(today());
  const [dueOn, setDueOn] = useState("");
  const [reference, setReference] = useState("");
  const [folio, setFolio] = useState("");
  const [notes, setNotes] = useState("");
  const [orderId, setOrderId] = useState(NO_ORDER);
  const [file, setFile] = useState<File | null>(null);

  const linkable = orders.filter((o) => o.status === "confirmado" || o.status === "entregado");
  const amountValue = parseAmount(amount);
  const fileError =
    file && !INVOICE_FILE_TYPES.includes(file.type)
      ? "Solo PDF, JPG, PNG o XML"
      : file && file.size > INVOICE_FILE_MAX_BYTES
        ? "El archivo supera 20 MB"
        : null;

  function openDialog(kind: "payment" | "invoice") {
    setAmount("");
    setMethod("transferencia");
    setDate(today());
    setDueOn("");
    setReference("");
    setFolio("");
    setNotes("");
    setOrderId(NO_ORDER);
    setFile(null);
    setDialog(kind);
  }

  async function submit() {
    if (!me || amountValue === null) return;
    setBusy(true);
    try {
      const order = orderId === NO_ORDER ? null : orderId;
      if (dialog === "payment") {
        await createPayment(
          supabase,
          account,
          { amount: amountValue, method, paid_at: new Date(`${date}T12:00:00`).toISOString(), reference, notes, order_id: order },
          me.id,
        );
        toast.success(`Pago de ${formatMoney(amountValue)} registrado`);
      } else {
        if (!folio.trim() || fileError) return;
        await createInvoice(
          supabase,
          account,
          { folio, amount: amountValue, issued_on: date, due_on: dueOn || null, notes, order_id: order },
          file,
          me.id,
        );
        toast.success(`Factura ${folio.trim()} registrada`);
      }
      setDialog(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, dialog === "payment" ? "No se pudo registrar el pago" : "No se pudo registrar la factura"));
    } finally {
      setBusy(false);
    }
  }

  async function openFile(path: string) {
    try {
      window.open(await invoiceFileUrl(supabase, path), "_blank", "noopener");
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo abrir el archivo"));
    }
  }

  async function changeInvoiceStatus(invoice: Invoice, status: string) {
    try {
      await setInvoiceStatus(supabase, invoice.id, status);
      toast.success(`Factura ${invoice.folio}: ${INVOICE_STATUS_LABELS[status]}`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo cambiar la factura"));
    }
  }

  const canSubmit =
    amountValue !== null && !busy && (dialog === "payment" || (folio.trim() !== "" && fileError === null));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Pagos</h3>
          <Button size="sm" onClick={() => openDialog("payment")}>
            <Icon name="agregar" /> Registrar pago
          </Button>
        </div>
        {payments === null && <p className="text-sm text-texto-suave">Cargando…</p>}
        {payments?.length === 0 && <p className="text-sm text-texto-suave">Sin pagos registrados.</p>}
        {payments && payments.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 p-3 text-sm">
                <span className="tabular-nums">{formatDate(p.paid_at)}</span>
                <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                {p.reference && <span className="text-texto-suave">Ref. {p.reference}</span>}
                <span className="ml-auto font-semibold tabular-nums">{formatMoney(p.amount)}</span>
                <span className="w-full text-xs text-texto-suave">
                  Registró {profileName(profiles.find((u) => u.id === p.recorded_by))}
                  {p.order_id && ` · Pedido #${orders.find((o) => o.id === p.order_id)?.order_number ?? "—"}`}
                  {p.notes && ` · ${p.notes}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Facturas</h3>
          <Button size="sm" variant="outline" onClick={() => openDialog("invoice")}>
            <Icon name="agregar" /> Registrar factura
          </Button>
        </div>
        {invoices === null && <p className="text-sm text-texto-suave">Cargando…</p>}
        {invoices?.length === 0 && <p className="text-sm text-texto-suave">Sin facturas registradas.</p>}
        {invoices && invoices.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                <span className="font-medium">{inv.folio}</span>
                <span className="text-texto-suave tabular-nums">{formatDate(inv.issued_on)}</span>
                {inv.due_on && <span className="text-xs text-texto-suave">Vence {formatDate(inv.due_on)}</span>}
                {isAdmin ? (
                  <Select value={inv.status} onValueChange={(v) => void changeInvoiceStatus(inv, v)}>
                    <SelectTrigger size="sm" className="h-7 w-32" aria-label={`Estado de la factura ${inv.folio}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs">{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</span>
                )}
                <span className="ml-auto font-semibold tabular-nums">{formatMoney(inv.amount)}</span>
                {inv.file_path && (
                  <Button size="sm" variant="ghost" onClick={() => void openFile(inv.file_path!)}>
                    <Icon name="adjuntar" /> Archivo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={dialog !== null} onOpenChange={(v) => !v && !busy && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "payment" ? "Registrar pago" : "Registrar factura"}</DialogTitle>
            <DialogDescription>
              {dialog === "payment"
                ? "El pago se descuenta del saldo de la cuenta. Solo un administrador puede corregirlo después."
                : "Registro administrativo de la factura (no timbra CFDI). El archivo es opcional."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {dialog === "invoice" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="inv-folio">Folio</Label>
                <Input id="inv-folio" value={folio} onChange={(e) => setFolio(e.target.value)} maxLength={60} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="fin-amount">Monto (MXN)</Label>
              <Input
                id="fin-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-date">{dialog === "payment" ? "Fecha del pago" : "Fecha de emisión"}</Label>
              <Input id="fin-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {dialog === "payment" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Método</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fin-ref">Referencia (opcional)</Label>
                  <Input id="fin-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-due">Vencimiento (opcional)</Label>
                  <Input id="inv-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-file">Archivo (PDF, imagen o XML)</Label>
                  <Input
                    id="inv-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.xml"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {fileError && <p className="text-xs text-error-texto">{fileError}</p>}
                </div>
              </>
            )}
            {linkable.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Pedido relacionado (opcional)</Label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ORDER}>Sin pedido específico</SelectItem>
                    {linkable.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        #{o.order_number} · {formatDate(o.ordered_at)} · {formatMoney(o.total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fin-notes">Notas (opcional)</Label>
              <Textarea id="fin-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} disabled={!canSubmit}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
