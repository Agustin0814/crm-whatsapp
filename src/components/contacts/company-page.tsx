"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ClassificationBadge } from "@/components/crm/classification-badge";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { TagChip } from "@/components/crm/tag-chip";
import { OrderDialog } from "@/components/orders/order-dialog";
import { OrdersList } from "@/components/orders/orders-list";
import { PaymentsInvoices } from "@/components/orders/payments-invoices";
import { useAccountData } from "@/components/orders/use-account-data";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchCompany, PAYMENT_TERMS_LABELS, setCompanyTag, updateCompany, type CompanyWithTags } from "@/lib/crm/companies";
import { errorMessage } from "@/lib/crm/contacts";
import { parseCustomFields, type CustomFields } from "@/lib/crm/types";
import { formatDate, formatMoney } from "@/lib/format";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { ClassificationControl } from "./classification-control";
import { CompanyLinks } from "./company-links";
import { CustomFieldsEditor } from "./custom-fields-editor";
import { EditableField } from "./editable-field";
import { TagPicker } from "./tag-picker";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

function SummaryCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs font-medium text-texto-suave">{label}</p>
      <p className={tone === "warn" ? "text-xl font-semibold text-advertencia-texto tabular-nums" : "text-xl font-semibold tabular-nums"}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-texto-suave">{hint}</p>}
    </div>
  );
}

/** Ficha completa de una empresa: resumen de cuenta, pedidos, pagos, contactos y condiciones. */
export function CompanyPage({ id }: { id: string }) {
  const supabase = createClient();
  const [company, setCompany] = useState<CompanyWithTags | null | undefined>(undefined);
  const [inactive, setInactive] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const account = useAccountData({ kind: "company", id });

  const load = useCallback(() => {
    fetchCompany(supabase, id)
      .then(setCompany)
      .catch((error) => {
        toast.error(errorMessage(error, "No se pudo cargar la empresa"));
        setCompany(null);
      });
    supabase
      .from("contact_directory")
      .select("is_inactive")
      .eq("kind", "company")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setInactive(data?.is_inactive === true));
  }, [supabase, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(patch: TablesUpdate<"companies">) {
    try {
      setCompany(await updateCompany(supabase, id, patch));
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      toast.error(code === "23505" ? "Ya existe otra empresa con ese nombre comercial" : errorMessage(error, "No se pudo guardar la empresa"));
      throw error;
    }
  }

  if (company === undefined) {
    return (
      <div className="space-y-4 p-4 md:p-6" aria-label="Cargando empresa">
        <Skeleton className="h-16 w-full max-w-md rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (company === null) {
    return (
      <EmptyState
        icon="empresa"
        title="Empresa no encontrada"
        description="Puede que se haya eliminado o que el enlace sea incorrecto."
        action={
          <Button asChild variant="outline">
            <Link href="/contactos">Volver a contactos</Link>
          </Button>
        }
      />
    );
  }

  const hasCredit = company.payment_terms === "credito" && company.credit_authorized_at !== null;
  const balance = account.balance?.balance ?? 0;
  const available = hasCredit && company.credit_limit !== null ? Number(company.credit_limit) - balance : null;
  const pendingCount = account.orders?.filter((o) => o.status === "pendiente_autorizacion").length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-4 md:px-6">
        <Button asChild variant="ghost" size="icon" aria-label="Volver a contactos">
          <Link href="/contactos?tab=empresas">
            <Icon name="chevron-abajo" className="size-5 rotate-90" />
          </Link>
        </Button>
        <ContactAvatar seed={company.id} name={company.trade_name} company={company.trade_name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{company.trade_name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
            <ClassificationBadge classification={company.classification} inactive={inactive} size="xs" />
            {company.legal_name && <span className="truncate">{company.legal_name}</span>}
            {company.rfc && <span className="uppercase">{company.rfc}</span>}
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setOrderOpen(true)}>
          <Icon name="agregar" /> Nuevo pedido
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Saldo"
              value={account.balance ? formatMoney(balance) : "…"}
              hint="Pedidos confirmados o entregados menos pagos"
            />
            <SummaryCard
              label="Crédito disponible"
              value={available === null ? (hasCredit ? "Sin límite" : "—") : formatMoney(available)}
              hint={hasCredit && company.credit_limit !== null ? `Límite ${formatMoney(company.credit_limit)}` : "Sin crédito autorizado"}
              tone={available !== null && available < 0 ? "warn" : undefined}
            />
            <SummaryCard
              label="Condiciones"
              value={hasCredit ? `Crédito ${company.credit_days ?? 0} días` : "Contado"}
              hint={
                company.last_purchase_at ? `Última compra ${formatDate(company.last_purchase_at)}` : "Sin compras registradas"
              }
            />
          </div>

          <Tabs defaultValue="pedidos" className="gap-4">
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b">
              <TabsList variant="line" className="h-11">
                <TabsTrigger value="pedidos" className="px-3">
                  Pedidos{pendingCount > 0 && ` (${pendingCount} por autorizar)`}
                </TabsTrigger>
                <TabsTrigger value="pagos" className="px-3">Pagos y facturas</TabsTrigger>
                <TabsTrigger value="contactos" className="px-3">Contactos vinculados</TabsTrigger>
                <TabsTrigger value="datos" className="px-3">Datos</TabsTrigger>
                <TabsTrigger value="condiciones" className="px-3">Condiciones</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="pedidos">
              <OrdersList
                orders={account.orders}
                show="requester"
                emptyText="Registra el primer pedido con «Nuevo pedido»."
                onChanged={() => {
                  account.reload();
                  load();
                }}
              />
            </TabsContent>
            <TabsContent value="pagos">
              <PaymentsInvoices
                account={{ kind: "company", id }}
                payments={account.payments}
                invoices={account.invoices}
                orders={account.orders ?? []}
                onChanged={account.reload}
              />
            </TabsContent>
            <TabsContent value="contactos">
              <CompanyLinks mode="company" companyId={id} />
            </TabsContent>
            <TabsContent value="datos">
              <CompanyData company={company} onSave={save} onChange={setCompany} onReload={load} inactive={inactive} />
            </TabsContent>
            <TabsContent value="condiciones">
              <CompanyConditions company={company} onSave={save} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <OrderDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        source={{ kind: "company", companyId: id, companyName: company.trade_name }}
        onCreated={() => {
          account.reload();
          load();
        }}
      />
    </div>
  );
}

function CompanyData({
  company,
  onSave,
  onChange,
  onReload,
  inactive,
}: {
  company: CompanyWithTags;
  onSave: (patch: TablesUpdate<"companies">) => Promise<void>;
  onChange: (company: CompanyWithTags) => void;
  onReload: () => void;
  inactive: boolean;
}) {
  const supabase = createClient();

  async function removeTag(tagId: string) {
    const previous = company.tags;
    onChange({ ...company, tags: previous.filter((t) => t.id !== tagId) });
    try {
      await setCompanyTag(supabase, company.id, tagId, false);
    } catch (error) {
      onChange({ ...company, tags: previous });
      toast.error(errorMessage(error, "No se pudo quitar la etiqueta"));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border p-4">
        <EditableField icon="empresa" label="Nombre comercial" value={company.trade_name} onSave={async (v) => {
          if (!v) {
            toast.error("El nombre comercial es obligatorio");
            throw new Error("vacío");
          }
          await onSave({ trade_name: v });
        }} />
        <EditableField icon="notas" label="Razón social" value={company.legal_name} onSave={(legal_name) => onSave({ legal_name })} />
        <EditableField
          icon="notas"
          label="RFC"
          value={company.rfc}
          validate={(v) => (RFC_RE.test(v) ? null : "RFC no válido (12 o 13 caracteres)")}
          onSave={(rfc) => onSave({ rfc: rfc?.toUpperCase() ?? null })}
        />
        <EditableField icon="telefono" label="Teléfono (fijo de la empresa)" type="tel" value={company.phone} onSave={(phone) => onSave({ phone })} />
        <EditableField
          icon="correo"
          label="Correo"
          type="email"
          value={company.email}
          validate={(v) => (EMAIL_RE.test(v) ? null : "Correo no válido")}
          onSave={(email) => onSave({ email })}
        />
        <EditableField icon="ubicacion" label="Dirección" value={company.address} onSave={(address) => onSave({ address })} />
        <EditableField icon="ubicacion" label="Ciudad" value={company.city} onSave={(city) => onSave({ city })} />
      </div>
      <div className="space-y-5">
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="text-xs font-bold tracking-wider uppercase">Clasificación</h3>
          <ClassificationControl
            entity="company"
            id={company.id}
            classification={company.classification}
            source={company.classification_source}
            classifiedAt={company.classified_at}
            inactive={inactive}
            onChanged={onReload}
          />
        </section>
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="text-xs font-bold tracking-wider uppercase">Etiquetas</h3>
          <div className="flex flex-wrap items-center gap-2">
            {company.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} dot onRemove={() => void removeTag(tag.id)} />
            ))}
            <TagPicker
              target={{ kind: "company", id: company.id }}
              value={company.tags}
              onChange={(tags) => onChange({ ...company, tags })}
              trigger={
                <Button variant="outline" size="sm" className="h-7 rounded-full px-3">
                  <Icon name="agregar" /> Etiqueta
                </Button>
              }
            />
          </div>
        </section>
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="text-xs font-bold tracking-wider uppercase">Notas</h3>
          <EditableField
            icon="notas"
            label="Notas"
            hideLabel
            multiline
            value={company.notes}
            placeholder="Información útil sobre la empresa…"
            onSave={(notes) => onSave({ notes })}
          />
        </section>
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="text-xs font-bold tracking-wider uppercase">Campos personalizados</h3>
          <CustomFieldsEditor
            fields={parseCustomFields(company.custom_fields)}
            onSave={(fields: CustomFields) => onSave({ custom_fields: fields })}
          />
        </section>
      </div>
    </div>
  );
}

/** Condiciones de pago. Solo un administrador las cambia (la base lo vuelve a comprobar). */
function CompanyConditions({
  company,
  onSave,
}: {
  company: CompanyWithTags;
  onSave: (patch: TablesUpdate<"companies">) => Promise<void>;
}) {
  const { isAdmin, profiles } = useCrm();
  const [terms, setTerms] = useState(company.payment_terms);
  const [days, setDays] = useState(company.credit_days === null ? "" : String(company.credit_days));
  const [limit, setLimit] = useState(company.credit_limit === null ? "" : String(company.credit_limit));
  const [saving, setSaving] = useState(false);

  const daysValue = days.trim() === "" ? null : Number(days);
  const limitValue = limit.trim() === "" ? null : Number(limit);
  const invalid =
    terms === "credito" &&
    (daysValue === null ||
      !Number.isInteger(daysValue) ||
      daysValue <= 0 ||
      (limitValue !== null && (!Number.isFinite(limitValue) || limitValue < 0)));

  async function save() {
    if (invalid) return;
    setSaving(true);
    try {
      await onSave(
        terms === "credito"
          ? { payment_terms: "credito", credit_days: daysValue, credit_limit: limitValue }
          : { payment_terms: "contado", credit_days: null, credit_limit: null },
      );
      toast.success("Condiciones actualizadas");
    } catch {
      // onSave ya mostró el error
    } finally {
      setSaving(false);
    }
  }

  const authorizer = profiles.find((p) => p.id === company.credit_authorized_by);

  return (
    <div className="max-w-xl space-y-4 rounded-xl border p-4">
      {!isAdmin && (
        <p className="rounded-lg bg-superficie-2 p-3 text-sm text-texto-suave">
          Solo un administrador puede cambiar las condiciones de pago o el crédito.
        </p>
      )}
      <div className="space-y-1.5">
        <Label>Forma de pago</Label>
        <Select value={terms} onValueChange={setTerms} disabled={!isAdmin}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_TERMS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {terms === "credito" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="credit-days">Días de crédito</Label>
            <Input
              id="credit-days"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={days}
              disabled={!isAdmin}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credit-limit">Límite de crédito (vacío = sin límite)</Label>
            <Input
              id="credit-limit"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={limit}
              disabled={!isAdmin}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
        </div>
      )}
      {invalid && <p className="text-xs text-error-texto">Indica los días de crédito (entero mayor que 0) y un límite válido.</p>}
      {company.credit_authorized_at && (
        <p className="text-xs text-texto-suave">
          Crédito autorizado por {profileName(authorizer)} el {formatDate(company.credit_authorized_at)}.
        </p>
      )}
      {isAdmin && (
        <Button onClick={() => void save()} disabled={saving || invalid}>
          {saving ? "Guardando…" : "Guardar condiciones"}
        </Button>
      )}
    </div>
  );
}
