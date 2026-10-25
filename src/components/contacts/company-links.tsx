"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  fetchLinks,
  linkContactToCompany,
  setLinkActive,
  setLinkRole,
  updateLinkPermissions,
  type LinkWithRoles,
} from "@/lib/crm/companies";
import { errorMessage } from "@/lib/crm/contacts";
import { formatMoney, formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { CompanyPicker } from "./company-picker";
import { ContactPicker } from "./contact-picker";

type Props =
  | { mode: "contact"; contactId: string; onChanged?: () => void }
  | { mode: "company"; companyId: string; onChanged?: () => void };

/** Resumen legible de los permisos de pedido de un vínculo. */
export function permissionSummary(link: Pick<LinkWithRoles, "can_order" | "order_limit" | "requires_authorization">) {
  if (!link.can_order) return "No puede hacer pedidos a nombre de la empresa";
  const parts = ["Puede pedir"];
  if (link.order_limit !== null) parts.push(`hasta ${formatMoney(link.order_limit)} por pedido`);
  if (link.requires_authorization) parts.push("siempre requiere autorización");
  return parts.join(" · ");
}

/**
 * Vínculos persona–empresa con sus funciones. Desde la persona se ven sus
 * empresas; desde la empresa, sus contactos. Cualquiera puede vincular,
 * desvincular (se desactiva, no se borra) y asignar funciones; los permisos de
 * pedido (puede pedir, límite, autorización) solo los cambia un administrador,
 * y la base lo vuelve a comprobar.
 */
export function CompanyLinks(props: Props) {
  const supabase = createClient();
  const { roles, isAdmin } = useCrm();
  const [links, setLinks] = useState<LinkWithRoles[] | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<LinkWithRoles | null>(null);
  const key = props.mode === "contact" ? props.contactId : props.companyId;
  const { mode, onChanged } = props;

  const load = useCallback(() => {
    const by = mode === "contact" ? { contactId: key } : { companyId: key };
    return fetchLinks(supabase, by)
      .then(setLinks)
      .catch((error) => toast.error(errorMessage(error, "No se pudieron cargar los vínculos")));
  }, [supabase, mode, key]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string, fallback: string): Promise<boolean> {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error, fallback));
      return false;
    }
    toast.success(success);
    await load();
    onChanged?.();
    return true;
  }

  async function toggleRole(link: LinkWithRoles, roleId: string, on: boolean) {
    // Actualización optimista: la lista de funciones cambia al instante.
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    setLinks((prev) =>
      prev?.map((l) =>
        l.id === link.id
          ? {
              ...l,
              roles: on
                ? [...l.roles, role].sort((a, b) => a.sort_order - b.sort_order)
                : l.roles.filter((r) => r.id !== roleId),
            }
          : l,
      ) ?? null,
    );
    try {
      await setLinkRole(supabase, link.id, roleId, on);
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo actualizar la función"));
      void load();
    }
  }

  const active = links?.filter((l) => l.is_active) ?? [];
  const inactive = links?.filter((l) => !l.is_active) ?? [];
  const linkedIds = (links ?? []).filter((l) => l.is_active).map((l) => (mode === "contact" ? l.company_id : l.contact_id));

  return (
    <div className="space-y-3">
      {links === null && <p className="text-sm text-texto-suave">Cargando…</p>}
      {links !== null && active.length === 0 && (
        <p className="text-sm text-texto-suave">
          {mode === "contact" ? "No está vinculado a ninguna empresa." : "Aún no hay personas vinculadas."}
        </p>
      )}

      <ul className="space-y-2">
        {[...active, ...(showInactive ? inactive : [])].map((link) => (
          <LinkRow
            key={link.id}
            link={link}
            mode={mode}
            isAdmin={isAdmin}
            onToggleRole={(roleId, on) => void toggleRole(link, roleId, on)}
            onEditPermissions={() => setEditing(link)}
            onSetActive={(on) =>
              void run(
                () => setLinkActive(supabase, link.id, on),
                on ? "Vínculo reactivado" : "Vínculo desactivado",
                "No se pudo actualizar el vínculo",
              )
            }
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "contact" ? (
          <CompanyPicker
            excludeIds={linkedIds}
            onSelect={async (company) => {
              await run(
                () => linkContactToCompany(supabase, props.contactId, company.id),
                `Vinculado a ${company.trade_name}`,
                "No se pudo vincular",
              );
            }}
          />
        ) : (
          <ContactPicker
            excludeIds={linkedIds}
            onSelect={async (contact) => {
              await run(
                () => linkContactToCompany(supabase, contact.id, props.companyId),
                `${contact.name || "Contacto"} vinculado`,
                "No se pudo vincular",
              );
            }}
          />
        )}
        {inactive.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? "Ocultar inactivos" : `Ver inactivos (${inactive.length})`}
          </Button>
        )}
      </div>

      {editing && (
        <PermissionsDialog
          link={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) =>
            run(
              () => updateLinkPermissions(supabase, editing.id, patch),
              "Permisos actualizados",
              "No se pudieron guardar los permisos",
            ).then((ok) => {
              if (ok) setEditing(null);
            })
          }
        />
      )}
    </div>
  );
}

function LinkRow({
  link,
  mode,
  isAdmin,
  onToggleRole,
  onEditPermissions,
  onSetActive,
}: {
  link: LinkWithRoles;
  mode: "contact" | "company";
  isAdmin: boolean;
  onToggleRole: (roleId: string, on: boolean) => void;
  onEditPermissions: () => void;
  onSetActive: (on: boolean) => void;
}) {
  const { roles } = useCrm();
  const roleIds = new Set(link.roles.map((r) => r.id));
  const other =
    mode === "contact"
      ? {
          href: `/contactos/empresa/${link.company_id}`,
          name: link.company?.trade_name ?? "Empresa",
          sub: null as string | null,
          avatar: <ContactAvatar seed={link.company_id} name={link.company?.trade_name} company={link.company?.trade_name} size="sm" />,
        }
      : {
          href: `/contactos/persona/${link.contact_id}`,
          name: link.contact?.name || "Sin nombre",
          sub: formatPhone(link.contact?.wa_id ?? link.contact?.phone),
          avatar: <ContactAvatar seed={link.contact?.wa_id ?? link.contact_id} name={link.contact?.name} size="sm" />,
        };

  return (
    <li className={cn("rounded-xl border p-3", !link.is_active && "opacity-60")}>
      <div className="flex items-start gap-3">
        {other.avatar}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2">
            <Link href={other.href} className="truncate font-medium hover:underline">
              {other.name}
            </Link>
            {other.sub && <span className="text-xs text-texto-suave tabular-nums">{other.sub}</span>}
            {!link.is_active && <span className="text-xs text-texto-suave">(inactivo)</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {link.roles.map((r) => (
              <span key={r.id} className="inline-flex h-5 items-center rounded-full bg-info/15 px-2 text-[0.6875rem] font-medium">
                {r.name}
              </span>
            ))}
            {link.is_active && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-5 items-center gap-1 rounded-full border border-dashed px-2 text-[0.6875rem] text-texto-suave hover:bg-superficie-2"
                  >
                    <Icon name="agregar" className="size-3" /> Función
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {roles.map((r) => (
                    <DropdownMenuCheckboxItem
                      key={r.id}
                      checked={roleIds.has(r.id)}
                      onCheckedChange={(checked) => onToggleRole(r.id, checked === true)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {r.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <p className="text-xs text-texto-suave">{permissionSummary(link)}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-1">
        {isAdmin && link.is_active && (
          <Button variant="ghost" size="sm" onClick={onEditPermissions}>
            Permisos de pedido
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onSetActive(!link.is_active)}>
          {link.is_active ? "Desvincular" : "Reactivar"}
        </Button>
      </div>
    </li>
  );
}

function PermissionsDialog({
  link,
  onClose,
  onSave,
}: {
  link: LinkWithRoles;
  onClose: () => void;
  onSave: (patch: { can_order: boolean; order_limit: number | null; requires_authorization: boolean }) => Promise<void>;
}) {
  const [canOrder, setCanOrder] = useState(link.can_order);
  const [limit, setLimit] = useState(link.order_limit === null ? "" : String(link.order_limit));
  const [requiresAuth, setRequiresAuth] = useState(link.requires_authorization);
  const [saving, setSaving] = useState(false);
  const limitValue = limit.trim() === "" ? null : Number(limit);
  const limitInvalid = limitValue !== null && (!Number.isFinite(limitValue) || limitValue < 0);

  async function save() {
    if (limitInvalid) return;
    setSaving(true);
    try {
      await onSave({ can_order: canOrder, order_limit: canOrder ? limitValue : null, requires_authorization: requiresAuth });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permisos de pedido</DialogTitle>
          <DialogDescription>
            {link.contact?.name || "Esta persona"} en {link.company?.trade_name ?? "la empresa"}. Solo un administrador
            puede cambiarlos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-medium">Puede hacer pedidos</span>
              <span className="block text-xs text-texto-suave">A nombre de la empresa.</span>
            </span>
            <Switch checked={canOrder} onCheckedChange={setCanOrder} />
          </label>
          <div className={cn("space-y-1.5", !canOrder && "opacity-50")}>
            <Label htmlFor={`limite-${link.id}`}>Límite por pedido (MXN, vacío = sin límite)</Label>
            <Input
              id={`limite-${link.id}`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={limit}
              disabled={!canOrder}
              onChange={(e) => setLimit(e.target.value)}
              aria-invalid={limitInvalid}
            />
            {limitInvalid && <p className="text-xs text-error-texto">Escribe un monto válido.</p>}
          </div>
          <label className="flex items-start gap-3">
            <Checkbox checked={requiresAuth} onCheckedChange={(v) => setRequiresAuth(v === true)} className="mt-0.5" />
            <span>
              <span className="block font-medium">Requiere autorización siempre</span>
              <span className="block text-xs text-texto-suave">
                Sus pedidos quedan «pendientes de autorización» hasta que un administrador los apruebe.
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || limitInvalid}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
