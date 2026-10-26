"use client";

import { Loader2Icon } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/crm/contacts";
import { notifyLinksChanged, updatePhone, type PhoneDecision, type PhoneMatch } from "@/lib/crm/phones";
import { formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { blockingMatch, PhoneConflictPanel, pendingMatches } from "./phone-conflict-panel";
import { useDefaultRoleIds } from "./roles-picker";
import { usePhoneMatches } from "./use-phone-matches";

type Props = {
  owner: { kind: "person" | "company"; id: string };
  label: string;
  value: string | null;
  /** Tras guardar (para recargar la ficha). */
  onSaved: () => void | Promise<void>;
};

/**
 * Teléfono editable en línea con verificación de duplicados. Igual que
 * EditableField (clic para editar, Enter o salir del campo guarda, Escape
 * descarta), pero si el número coincide con otro registro se queda editando y
 * muestra el aviso con sus opciones. El guardado (`update_phone`) vuelve a
 * comprobar en la base y nunca confía solo en la elección del cliente.
 */
export function PhoneField({ owner, label, value, onSaved }: Props) {
  const supabase = createClient();
  const id = useId();
  const defaultRoleIds = useDefaultRoleIds();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [decision, setDecision] = useState<PhoneDecision | null>(null);
  const [serverMatches, setServerMatches] = useState<{ phone: string; matches: PhoneMatch[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const live = usePhoneMatches(draft, owner, editing);
  const matches = serverMatches?.phone === draft ? serverMatches.matches : live.matches;
  const blocking = blockingMatch(owner.kind, matches);
  const pending = pendingMatches(matches);
  const tooShort = draft.trim() !== "" && draft.replace(/\D/g, "").length < 10;
  const hasConflict = blocking !== null || pending.length > 0;

  function start() {
    setDraft(value ?? "");
    setDecision(null);
    setServerMatches(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(value ?? "");
    setDecision(null);
    setServerMatches(null);
    setEditing(false);
  }

  async function commit(confirmed: boolean) {
    const next = draft.trim();
    if (next === (value ?? "")) {
      cancel();
      return;
    }
    if (tooShort) return;
    // Con un aviso a la vista, guardar al salir del campo no basta: hay que elegir una opción.
    if (blocking || (pending.length > 0 && !(confirmed && decision))) return;
    setSaving(true);
    try {
      const result = await updatePhone(supabase, owner, next || null, matches, decision);
      if (result.status === "blocked") {
        setServerMatches({ phone: draft, matches: [result.match] });
        return;
      }
      if (result.status === "needs_confirmation") {
        setServerMatches({ phone: draft, matches: result.matches });
        setDecision(null);
        return;
      }
      if (decision?.mode === "link") notifyLinksChanged();
      toast.success(decision?.mode === "link" ? "Teléfono guardado y vinculado" : "Teléfono guardado");
      setEditing(false);
      setDecision(null);
      setServerMatches(null);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo guardar el teléfono"));
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void commit(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-texto-suave">
        <Icon name="telefono" className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-texto-suave">
          {label}
          {(saving || live.checking) && <Loader2Icon className="size-3 animate-spin" aria-label="Verificando" />}
        </label>

        {editing ? (
          <div className="space-y-2">
            <Input
              id={id}
              autoFocus
              type="tel"
              inputMode="tel"
              value={draft}
              placeholder="644 123 4567"
              onChange={(e) => {
                setDraft(e.target.value);
                setDecision(null);
              }}
              onBlur={() => {
                live.checkNow();
                if (!hasConflict) void commit(false);
              }}
              onKeyDown={handleKeyDown}
              aria-invalid={tooShort || blocking !== null}
            />
            {tooShort && <p className="text-xs text-error-texto">Escribe al menos 10 dígitos.</p>}
            <PhoneConflictPanel
              ownerKind={owner.kind}
              action="edit"
              matches={matches}
              decision={decision}
              onDecision={setDecision}
              defaultRoleIds={defaultRoleIds}
              onCancel={cancel}
            />
            {hasConflict && !blocking && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void commit(true)} disabled={!decision || saving}>
                  {decision?.mode === "link" ? "Guardar y vincular" : "Guardar de todos modos"}
                </Button>
                <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        ) : value ? (
          <button
            id={id}
            type="button"
            onClick={start}
            className="-mx-1.5 block w-[calc(100%+0.75rem)] rounded-md px-1.5 py-0.5 text-left text-[0.9375rem] tabular-nums hover:bg-superficie-2"
            aria-label={`${label}: ${formatPhone(value)}. Editar`}
          >
            {formatPhone(value)}
          </button>
        ) : (
          <button
            id={id}
            type="button"
            onClick={start}
            className="flex h-9 w-full items-center gap-1 rounded-lg border border-dashed border-borde-control px-3 text-sm text-texto-suave hover:border-marca hover:text-marca-texto"
            aria-label={`Agregar ${label.toLowerCase()}`}
          >
            <Icon name="agregar" className="size-3.5" /> Agregar
          </button>
        )}
      </div>
    </div>
  );
}
