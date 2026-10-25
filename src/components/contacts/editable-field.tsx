"use client";

import { Loader2Icon, type LucideIcon } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | null;
  /** Icono de marca (nombre) o de lucide si no hay equivalente. */
  icon?: IconName | LucideIcon;
  placeholder?: string;
  multiline?: boolean;
  type?: "text" | "email" | "tel";
  /** Cómo mostrar el valor (p. ej. teléfono con formato). Solo visual. */
  format?: (value: string) => string;
  /** Guarda el valor (ya recortado; "" se guarda como null). Debe lanzar si falla. */
  onSave: (value: string | null) => Promise<void>;
  validate?: (value: string) => string | null;
  /** Sin etiqueta visible (la etiqueta queda solo para lectores de pantalla). */
  hideLabel?: boolean;
};

/**
 * Campo de la ficha editable en línea:
 *  - con valor: se muestra como texto; clic (o Enter) para editar;
 *  - vacío: casilla punteada «+ Agregar»;
 *  - editando: guarda al salir del campo o con Enter; Escape descarta.
 */
export function EditableField({
  label,
  value,
  icon,
  placeholder,
  multiline,
  type = "text",
  format,
  onSave,
  validate,
  hideLabel,
}: Props) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(value ?? "");
    setError(null);
    setEditing(true);
  }

  async function commit() {
    const next = draft.trim();
    if (next === (value ?? "")) {
      setEditing(false);
      return;
    }
    const problem = next && validate ? validate(next) : null;
    if (problem) {
      setError(problem);
      return; // se queda editando para corregir
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(next || null);
      setEditing(false);
    } catch {
      setDraft(value ?? ""); // el padre ya mostró el toast de error
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value ?? "");
      setError(null);
      setEditing(false);
    }
    if (event.key === "Enter" && (!multiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void commit();
    }
  }

  const LucideComp = icon && typeof icon !== "string" ? icon : null;

  return (
    <div className="flex items-start gap-3">
      {icon && (
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-texto-suave">
          {typeof icon === "string" ? <Icon name={icon} className="size-5" /> : LucideComp && <LucideComp className="size-5" aria-hidden />}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <label
          htmlFor={id}
          className={cn("flex items-center gap-1.5 text-xs font-medium text-texto-suave", hideLabel && "sr-only")}
        >
          {label}
          {saving && <Loader2Icon className="size-3 animate-spin" aria-label="Guardando" />}
        </label>

        {editing ? (
          multiline ? (
            <Textarea
              id={id}
              autoFocus
              value={draft}
              rows={3}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={handleKeyDown}
              aria-invalid={error ? true : undefined}
              className="min-h-20 resize-none"
            />
          ) : (
            <Input
              id={id}
              autoFocus
              type={type}
              value={draft}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={handleKeyDown}
              aria-invalid={error ? true : undefined}
            />
          )
        ) : value ? (
          <button
            id={id}
            type="button"
            onClick={startEditing}
            className="-mx-1.5 block w-[calc(100%+0.75rem)] rounded-md px-1.5 py-0.5 text-left text-[0.9375rem] break-words whitespace-pre-wrap hover:bg-superficie-2"
            aria-label={`${label}: ${format ? format(value) : value}. Editar`}
          >
            {format ? format(value) : value}
          </button>
        ) : (
          <button
            id={id}
            type="button"
            onClick={startEditing}
            className="flex h-9 w-full items-center gap-1 rounded-lg border border-dashed border-borde-control px-3 text-sm text-texto-suave hover:border-marca hover:text-marca-texto"
            aria-label={`Agregar ${label.toLowerCase()}`}
          >
            <Icon name="agregar" className="size-3.5" /> Agregar
          </button>
        )}
        {error && <p className="text-xs text-error-texto">{error}</p>}
      </div>
    </div>
  );
}
