"use client";

import { HashIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import type { CustomFields } from "@/lib/crm/types";
import { EditableField } from "./editable-field";

type Props = {
  fields: CustomFields;
  /** Guarda el objeto completo. Debe lanzar si falla. */
  onSave: (fields: CustomFields) => Promise<void>;
};

/** Normaliza para comparar nombres de campo: "Ciudad", "ciudad ", "CIUDAD" → "ciudad". */
function normalizeKey(key: string): string {
  return key
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Campos personalizados (clave → valor) guardados en contacts.custom_fields. */
export function CustomFieldsEditor({ fields, onSave }: Props) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const entries = Object.entries(fields);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = newKey.trim();
    if (!key) return;
    setAdding(true);
    try {
      await onSave({ ...fields, [key]: newValue.trim() });
      setNewKey("");
      setNewValue("");
    } catch {
      // El toast lo muestra el padre.
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(key: string) {
    const next = { ...fields };
    delete next[key];
    await onSave(next).catch(() => undefined);
  }

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="text-sm text-texto-suave">Agrega datos propios, por ejemplo «Ciudad» o «Plan».</p>
      )}
      {entries.map(([key, value]) => (
        <div key={key} className="group flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <EditableField
              // «ciudad» usa el icono de ubicación; el resto, uno neutro.
              icon={normalizeKey(key) === "ciudad" ? "ubicacion" : HashIcon}
              label={key}
              value={value || null}
              onSave={(v) => onSave({ ...fields, [key]: v ?? "" })}
            />
          </div>
          <IconButton
            label={`Eliminar campo ${key}`}
            size="icon-sm"
            className="mt-4 text-texto-suave opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => void handleRemove(key)}
          >
            <Trash2Icon aria-hidden />
          </IconButton>
        </div>
      ))}

      <form onSubmit={handleAdd} className="flex gap-2 pt-1">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Campo"
          className="h-9 min-w-0 flex-1"
          maxLength={40}
          aria-label="Nombre del campo nuevo"
        />
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Valor"
          className="h-9 min-w-0 flex-1"
          aria-label="Valor del campo nuevo"
        />
        <IconButton
          type="submit"
          label="Agregar campo"
          variant="outline"
          size="icon-lg"
          className="size-9"
          disabled={!newKey.trim() || adding}
        >
          <Icon name="agregar" />
        </IconButton>
      </form>
    </div>
  );
}
