import type { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

type BrowserClient = ReturnType<typeof createClient>;

export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type Payment = Tables<"payments">;
export type Invoice = Tables<"invoices">;

/** Pedido con sus líneas y los nombres que se muestran en las listas. */
export type OrderWithDetails = Order & {
  items: OrderItem[];
  requester: { id: string; name: string | null } | null;
  company: { id: string; trade_name: string } | null;
};

/** Cuenta a la que se factura: una persona o una empresa (nunca ambas). */
export type Account = { kind: "contact"; id: string } | { kind: "company"; id: string };

export const ORDER_STATUSES = ["pendiente_autorizacion", "confirmado", "entregado", "cancelado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pendiente_autorizacion: "Pendiente de autorización",
  confirmado: "Confirmado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ORDER_STATUS_STYLES: Record<string, string> = {
  pendiente_autorizacion: "bg-advertencia-suave text-advertencia-texto",
  confirmado: "bg-info/15 text-texto",
  entregado: "bg-exito-suave text-exito-texto",
  cancelado: "bg-superficie-2 text-texto-suave line-through",
};

export const PAYMENT_METHODS = ["efectivo", "transferencia", "deposito", "tarjeta", "cheque", "otro"] as const;
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  deposito: "Depósito",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
  otro: "Otro",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  cancelada: "Cancelada",
};

export type OrderLineInput = { description: string; quantity: number; unit: string; unit_price: number };

const ORDER_SELECT =
  "*, order_items(*), requester:contacts!orders_requested_by_fkey(id, name), companies(id, trade_name)" as const;

type RawOrder = Order & {
  order_items: OrderItem[];
  requester: OrderWithDetails["requester"];
  companies: OrderWithDetails["company"];
};

function normalizeOrder(raw: RawOrder): OrderWithDetails {
  const { order_items, requester, companies, ...order } = raw;
  return { ...order, items: [...order_items].sort((a, b) => a.position - b.position), requester, company: companies };
}

/** Línea × precio redondeado a centavos (igual que la base). */
export function lineTotal(line: Pick<OrderLineInput, "quantity" | "unit_price">): number {
  return Math.round(line.quantity * line.unit_price * 100) / 100;
}

// --- Pedidos -------------------------------------------------------------------------

/**
 * Registra un pedido. La base calcula el total, decide si queda confirmado o
 * pendiente de autorización (permisos del solicitante, límite por pedido,
 * límite de crédito) y si se cobra al entregar.
 */
export async function createOrder(
  supabase: BrowserClient,
  args: {
    account: Account;
    requestedBy: string | null;
    conversationId: string | null;
    items: OrderLineInput[];
    notes: string;
  },
): Promise<Order> {
  const { data, error } = await supabase.rpc("create_order", {
    // Los parámetros opcionales de la función aceptan null aunque el tipo generado diga string.
    p_contact_id: (args.account.kind === "contact" ? args.account.id : null) as unknown as string,
    p_company_id: (args.account.kind === "company" ? args.account.id : null) as unknown as string,
    p_requested_by: args.requestedBy as unknown as string,
    p_conversation_id: args.conversationId as unknown as string,
    p_items: args.items,
    p_notes: args.notes.trim(),
  });
  if (error) throw error;
  return data;
}

/** Aprueba un pedido pendiente (solo administrador; el motivo es obligatorio). */
export async function approveOrder(supabase: BrowserClient, orderId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("approve_order", { p_order_id: orderId, p_note: note.trim() });
  if (error) throw error;
}

/** Marca un pedido como entregado o cancelado (la base impide los saltos no válidos). */
export async function setOrderStatus(supabase: BrowserClient, orderId: string, status: "entregado" | "cancelado") {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}

/** Pedidos facturados a la cuenta (persona o empresa), del más reciente al más antiguo. */
export async function fetchAccountOrders(supabase: BrowserClient, account: Account): Promise<OrderWithDetails[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq(account.kind === "contact" ? "contact_id" : "company_id", account.id)
    .order("ordered_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as unknown as RawOrder[]).map(normalizeOrder);
}

/** Pedidos que la persona solicitó a nombre de alguna empresa (como empleado). */
export async function fetchOrdersRequestedFor(supabase: BrowserClient, contactId: string): Promise<OrderWithDetails[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("requested_by", contactId)
    .not("company_id", "is", null)
    .order("ordered_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as unknown as RawOrder[]).map(normalizeOrder);
}

// --- Pagos y facturas ----------------------------------------------------------------------

export async function fetchAccountPayments(supabase: BrowserClient, account: Account): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq(account.kind === "contact" ? "contact_id" : "company_id", account.id)
    .order("paid_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function createPayment(
  supabase: BrowserClient,
  account: Account,
  values: { amount: number; method: string; paid_at: string; reference: string; notes: string; order_id: string | null },
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("payments").insert({
    ...(account.kind === "contact" ? { contact_id: account.id } : { company_id: account.id }),
    amount: values.amount,
    method: values.method,
    paid_at: values.paid_at,
    reference: values.reference.trim() || null,
    notes: values.notes.trim() || null,
    order_id: values.order_id,
    recorded_by: userId,
  });
  if (error) throw error;
}

export async function fetchAccountInvoices(supabase: BrowserClient, account: Account): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq(account.kind === "contact" ? "contact_id" : "company_id", account.id)
    .order("issued_on", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export const INVOICE_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "application/xml", "text/xml"];
export const INVOICE_FILE_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Registra una factura (registro administrativo, no CFDI). El archivo es
 * opcional: se sube desde el navegador al bucket privado «documentos» en
 * facturas/{usuario}/…; si el registro falla, se borra el archivo subido.
 */
export async function createInvoice(
  supabase: BrowserClient,
  account: Account,
  values: { folio: string; amount: number; issued_on: string; due_on: string | null; notes: string; order_id: string | null },
  file: File | null,
  userId: string,
): Promise<void> {
  let filePath: string | null = null;
  if (file) {
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
    filePath = `facturas/${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(filePath, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) throw uploadError;
  }
  const { error } = await supabase.from("invoices").insert({
    ...(account.kind === "contact" ? { contact_id: account.id } : { company_id: account.id }),
    folio: values.folio.trim(),
    amount: values.amount,
    issued_on: values.issued_on,
    due_on: values.due_on,
    notes: values.notes.trim() || null,
    order_id: values.order_id,
    file_path: filePath,
    recorded_by: userId,
  });
  if (error) {
    if (filePath) await supabase.storage.from("documentos").remove([filePath]);
    throw error;
  }
}

/** Cambia el estado de una factura (solo administrador, lo exige la base). */
export async function setInvoiceStatus(supabase: BrowserClient, id: string, status: string) {
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
  if (error) throw error;
}

/** URL firmada de corta duración para ver el archivo de una factura. */
export async function invoiceFileUrl(supabase: BrowserClient, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

// --- Saldo ---------------------------------------------------------------------------------

/**
 * Saldo de la cuenta = pedidos confirmados o entregados − pagos. Los pedidos
 * pendientes de autorización y los cancelados no suman.
 */
export async function fetchBalance(
  supabase: BrowserClient,
  account: Account,
): Promise<{ orders: number; payments: number; balance: number }> {
  const { data, error } = await supabase
    .from("account_balances")
    .select("orders_total, payments_total, balance")
    .eq(account.kind === "contact" ? "contact_id" : "company_id", account.id)
    .maybeSingle();
  if (error) throw error;
  return {
    orders: Number(data?.orders_total ?? 0),
    payments: Number(data?.payments_total ?? 0),
    balance: Number(data?.balance ?? 0),
  };
}
