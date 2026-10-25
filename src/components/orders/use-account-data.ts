"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/crm/contacts";
import {
  fetchAccountInvoices,
  fetchAccountOrders,
  fetchAccountPayments,
  fetchBalance,
  type Account,
  type Invoice,
  type OrderWithDetails,
  type Payment,
} from "@/lib/crm/orders";
import { createClient } from "@/lib/supabase/client";

export type AccountData = {
  orders: OrderWithDetails[] | null;
  payments: Payment[] | null;
  invoices: Invoice[] | null;
  balance: { orders: number; payments: number; balance: number } | null;
  reload: () => void;
};

/** Pedidos, pagos, facturas y saldo de una cuenta (persona o empresa). */
export function useAccountData(account: Account): AccountData {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderWithDetails[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [balance, setBalance] = useState<AccountData["balance"]>(null);
  const [version, setVersion] = useState(0);
  const { kind, id } = account;

  useEffect(() => {
    let cancelled = false;
    const acc = { kind, id } as Account;
    Promise.all([
      fetchAccountOrders(supabase, acc),
      fetchAccountPayments(supabase, acc),
      fetchAccountInvoices(supabase, acc),
      fetchBalance(supabase, acc),
    ])
      .then(([o, p, i, b]) => {
        if (cancelled) return;
        setOrders(o);
        setPayments(p);
        setInvoices(i);
        setBalance(b);
      })
      .catch((error) => toast.error(errorMessage(error, "No se pudieron cargar pedidos y pagos")));
    return () => {
      cancelled = true;
    };
  }, [supabase, kind, id, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { orders, payments, invoices, balance, reload };
}
