"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClassificationBadge } from "@/components/crm/classification-badge";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { EmptyState } from "@/components/crm/empty-state";
import { OrderDialog } from "@/components/orders/order-dialog";
import { OrdersList } from "@/components/orders/orders-list";
import { PaymentsInvoices } from "@/components/orders/payments-invoices";
import { useAccountData } from "@/components/orders/use-account-data";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, fetchContact } from "@/lib/crm/contacts";
import { fetchOrdersRequestedFor, type OrderWithDetails } from "@/lib/crm/orders";
import type { ContactWithTags } from "@/lib/crm/types";
import { formatDate, formatMoney, formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { ContactDetails } from "./contact-details";

/**
 * Ficha completa de una persona: datos (editables), y por separado sus
 * compras personales y los pedidos que hizo a nombre de empresas.
 */
export function PersonPage({ id }: { id: string }) {
  const supabase = createClient();
  const [contact, setContact] = useState<ContactWithTags | null | undefined>(undefined);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [inactive, setInactive] = useState(false);
  const [asEmployee, setAsEmployee] = useState<OrderWithDetails[] | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const account = useAccountData({ kind: "contact", id });

  const load = useCallback(() => {
    fetchContact(supabase, id)
      .then(setContact)
      .catch((error) => {
        // PGRST116 = no existe (single() sin filas).
        if ((error as { code?: string }).code !== "PGRST116") toast.error(errorMessage(error, "No se pudo cargar el contacto"));
        setContact(null);
      });
    supabase
      .from("contact_directory")
      .select("is_inactive, conversation_id")
      .eq("kind", "person")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setInactive(data?.is_inactive === true);
        setConversationId(data?.conversation_id ?? null);
      });
    fetchOrdersRequestedFor(supabase, id)
      .then(setAsEmployee)
      .catch(() => setAsEmployee([]));
  }, [supabase, id]);

  useEffect(() => {
    load();
  }, [load]);

  function reloadAll() {
    account.reload();
    load();
  }

  if (contact === undefined) {
    return (
      <div className="space-y-4 p-4 md:p-6" aria-label="Cargando contacto">
        <Skeleton className="h-16 w-full max-w-md rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }
  if (contact === null) {
    return (
      <EmptyState
        icon="persona"
        title="Contacto no encontrado"
        description="Puede que se haya eliminado o que el enlace sea incorrecto."
        action={
          <Button asChild variant="outline">
            <Link href="/contactos">Volver a contactos</Link>
          </Button>
        }
      />
    );
  }

  const name = contact.name || formatPhone(contact.wa_id ?? contact.phone);
  const balance = account.balance?.balance ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-4 md:px-6">
        <Button asChild variant="ghost" size="icon" aria-label="Volver a contactos">
          <Link href="/contactos">
            <Icon name="chevron-abajo" className="size-5 rotate-90" />
          </Link>
        </Button>
        <ContactAvatar seed={contact.wa_id ?? contact.id} name={contact.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
            <ClassificationBadge classification={contact.classification} inactive={inactive} size="xs" />
            <span className="whitespace-nowrap tabular-nums">{formatPhone(contact.wa_id ?? contact.phone)}</span>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {conversationId ? (
            <Button asChild variant="outline">
              <Link href={`/?c=${conversationId}`}>
                <Icon name="bandeja" /> Abrir conversación
              </Link>
            </Button>
          ) : (
            <span className="self-center text-xs text-texto-suave">Sin conversación de WhatsApp</span>
          )}
          <Button onClick={() => setOrderOpen(true)}>
            <Icon name="agregar" /> Nuevo pedido
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-5 p-4 md:p-6 lg:grid-cols-[22rem_1fr]">
          <div className="rounded-xl border p-4 lg:self-start">
            <ContactDetails contact={contact} onContactChange={setContact} showFullLink={false} />
          </div>

          <div className="min-w-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs font-medium text-texto-suave">Saldo personal</p>
                <p className="text-xl font-semibold tabular-nums">{account.balance ? formatMoney(balance) : "…"}</p>
                <p className="mt-0.5 text-xs text-texto-suave">Compras personales, siempre de contado</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-medium text-texto-suave">Última compra personal</p>
                <p className="text-xl font-semibold tabular-nums">
                  {contact.last_purchase_at ? formatDate(contact.last_purchase_at) : "—"}
                </p>
                <p className="mt-0.5 text-xs text-texto-suave">
                  Los pedidos a nombre de una empresa cuentan para la empresa
                </p>
              </div>
            </div>

            <Tabs defaultValue="personales" className="gap-4">
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b">
                <TabsList variant="line" className="h-11">
                  <TabsTrigger value="personales" className="px-3">Pedidos personales</TabsTrigger>
                  <TabsTrigger value="empleado" className="px-3">
                    Como empleado{asEmployee && asEmployee.length > 0 ? ` (${asEmployee.length})` : ""}
                  </TabsTrigger>
                  <TabsTrigger value="pagos" className="px-3">Pagos y facturas</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="personales">
                <OrdersList
                  orders={account.orders}
                  show="none"
                  emptyText="Compras que esta persona hizo para sí misma."
                  onChanged={reloadAll}
                />
              </TabsContent>
              <TabsContent value="empleado">
                <OrdersList
                  orders={asEmployee}
                  show="company"
                  emptyText="Pedidos que solicitó a nombre de una empresa vinculada."
                  onChanged={reloadAll}
                />
              </TabsContent>
              <TabsContent value="pagos">
                <PaymentsInvoices
                  account={{ kind: "contact", id }}
                  payments={account.payments}
                  invoices={account.invoices}
                  orders={account.orders ?? []}
                  onChanged={account.reload}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <OrderDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        source={{ kind: "contact", contactId: id, contactName: name, conversationId }}
        onCreated={reloadAll}
      />
    </div>
  );
}
