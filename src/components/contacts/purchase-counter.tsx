"use client";

import { MinusIcon, PlusIcon, ShoppingBagIcon } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/crm/contacts";
import {
  notifyContactsChanged,
  updatePurchaseCount,
  type EntityRef,
  type PurchaseResult,
  type PurchaseState,
} from "@/lib/crm/purchases";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Props = {
  entity: EntityRef;
  state: PurchaseState;
  /** Estado nuevo (optimista o el confirmado por la base). */
  onChange: (state: PurchaseState) => void;
};

const UNDO_MS = 6000;

function pick(result: PurchaseResult): PurchaseState {
  const { purchase_count, last_purchase_at, classification, classification_source, classified_at } = result;
  return { purchase_count, last_purchase_at, classification, classification_source, classified_at };
}

/**
 * Fila «Compras» de la ficha: − número +. Sin diálogos: «+» suma al instante
 * (y pasa a Cliente si estaba Sin clasificar o Prospecto), «−» resta, y el
 * número se puede escribir a mano. La interfaz cambia antes de la respuesta
 * y vuelve atrás si la base falla. Qué compró va en una nota interna del chat.
 */
export function PurchaseCounter({ entity, state, onChange }: Props) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const count = state.purchase_count;

  async function apply(optimistic: PurchaseState, run: () => Promise<PurchaseResult>, fallback: string) {
    const snapshot = state;
    onChange(optimistic);
    try {
      const result = await run();
      onChange(pick(result));
      notifyContactsChanged();
      return result;
    } catch (error) {
      onChange(snapshot);
      toast.error(errorMessage(error, fallback));
      return null;
    }
  }

  async function increment() {
    const promoted = state.classification === "unclassified" || state.classification === "prospect";
    const result = await apply(
      {
        ...state,
        purchase_count: count + 1,
        last_purchase_at: new Date().toISOString(),
        ...(promoted ? { classification: "customer", classification_source: "purchase" } : {}),
      },
      () => updatePurchaseCount(supabase, entity, { action: "increment" }),
      "No se pudo registrar la compra",
    );
    if (!result) return;
    toast.success(result.promoted ? "Compra registrada · ahora es Cliente" : "Compra registrada", {
      duration: UNDO_MS,
      action: {
        label: "Deshacer",
        onClick: () =>
          void apply(result.previous, () => updatePurchaseCount(supabase, entity, { action: "undo", undo: result }), "No se pudo deshacer"),
      },
    });
  }

  function decrement() {
    if (count === 0) return;
    const next = count - 1;
    void apply(
      { ...state, purchase_count: next, last_purchase_at: next === 0 ? null : state.last_purchase_at },
      () => updatePurchaseCount(supabase, entity, { action: "decrement" }),
      "No se pudo restar la compra",
    );
  }

  function commit() {
    setEditing(false);
    const value = Number(draft);
    if (draft.trim() === "" || value === count) return;
    if (!Number.isInteger(value) || value < 0 || value > 100000) {
      toast.error("Escribe un número entero de 0 o más");
      return;
    }
    void apply(
      { ...state, purchase_count: value, last_purchase_at: value === 0 ? null : state.last_purchase_at },
      () => updatePurchaseCount(supabase, entity, { action: "set", value }),
      "No se pudo guardar el contador",
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-texto-suave">
        <ShoppingBagIcon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-texto-suave">Compras</p>
        <div className="flex items-center gap-1">
          <IconButton label="Restar una compra" size="icon-sm" variant="outline" onClick={decrement} disabled={count === 0}>
            <MinusIcon className="size-4" aria-hidden />
          </IconButton>
          {editing ? (
            <Input
              autoFocus
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={handleKeyDown}
              className="h-8 w-20 text-center tabular-nums"
              aria-label="Número de compras"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(String(count));
                setEditing(true);
              }}
              className="h-8 min-w-12 rounded-md px-2 text-center text-[0.9375rem] font-semibold tabular-nums hover:bg-superficie-2"
              aria-label={`Compras: ${count}. Escribir el número`}
            >
              {count}
            </button>
          )}
          <IconButton label="Sumar una compra" size="icon-sm" variant="outline" onClick={() => void increment()}>
            <PlusIcon className="size-4" aria-hidden />
          </IconButton>
        </div>
        {state.last_purchase_at && (
          <p className="text-xs text-texto-suave">Última: {formatDate(state.last_purchase_at)}</p>
        )}
      </div>
    </div>
  );
}
