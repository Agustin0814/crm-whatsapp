"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { errorMessage, isUniqueViolation } from "@/lib/crm/contacts";
import type { ContactRole } from "@/lib/crm/companies";
import { createClient } from "@/lib/supabase/client";
import { SectionHeader } from "./section-header";

/**
 * Catálogo de funciones de una persona dentro de una empresa (Compras, Pagos,
 * Recibe material…). Solo el administrador lo edita; las funciones del
 * sistema se pueden renombrar pero no borrar.
 */
export function RolesSettings() {
  const supabase = createClient();
  const { roles, isAdmin, reloadRoles } = useCrm();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => PromiseLike<{ error: unknown }>, success: string, fallback: string) {
    setBusy(true);
    try {
      const { error } = await action();
      if (error) {
        toast.error(isUniqueViolation(error) ? "Ya existe una función con ese nombre" : errorMessage(error, fallback));
        return false;
      }
      toast.success(success);
      await reloadRoles();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    const sortOrder = Math.max(0, ...roles.map((r) => r.sort_order)) + 10;
    const ok = await run(
      () => supabase.from("contact_roles").insert({ name, sort_order: sortOrder }),
      `Función «${name}» creada`,
      "No se pudo crear la función",
    );
    if (ok) setNewName("");
  }

  async function rename() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    const ok = await run(
      () => supabase.from("contact_roles").update({ name }).eq("id", editing.id),
      "Función renombrada",
      "No se pudo renombrar",
    );
    if (ok) setEditing(null);
  }

  async function remove(role: ContactRole) {
    if (!window.confirm(`¿Eliminar la función «${role.name}»? Se quitará de todas las personas que la tengan.`)) return;
    await run(
      () => supabase.from("contact_roles").delete().eq("id", role.id),
      "Función eliminada",
      "No se pudo eliminar",
    );
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Funciones"
        description="Qué hace cada persona dentro de una empresa. Se asignan en el vínculo persona–empresa y sirven para filtrar el directorio."
      />
      {!isAdmin && (
        <p className="rounded-lg bg-superficie-2 p-3 text-sm text-texto-suave">Solo un administrador puede editar el catálogo.</p>
      )}
      <ul className="divide-y rounded-xl border">
        {roles.map((role) => (
          <li key={role.id} className="flex items-center gap-2 px-4 py-2.5">
            {editing?.id === role.id ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void rename();
                }}
              >
                <Input
                  autoFocus
                  value={editing.name}
                  onChange={(e) => setEditing({ id: role.id, name: e.target.value })}
                  maxLength={60}
                  aria-label="Nombre de la función"
                />
                <Button type="submit" size="sm" disabled={busy || !editing.name.trim()}>
                  Guardar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-sm">{role.name}</span>
                {role.is_system && <span className="text-xs text-texto-suave">Del sistema</span>}
                {isAdmin && (
                  <>
                    <IconButton label={`Renombrar ${role.name}`} onClick={() => setEditing({ id: role.id, name: role.name })}>
                      <Icon name="notas" className="size-4" />
                    </IconButton>
                    {!role.is_system && (
                      <IconButton label={`Eliminar ${role.name}`} onClick={() => void remove(role)} disabled={busy}>
                        <Icon name="cerrar" className="size-4" />
                      </IconButton>
                    )}
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <form
          className="flex max-w-md items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nueva función, p. ej. «Residente de obra»"
            maxLength={60}
            aria-label="Nueva función"
          />
          <Button type="submit" disabled={busy || !newName.trim()}>
            <Icon name="agregar" /> Agregar
          </Button>
        </form>
      )}
    </section>
  );
}
