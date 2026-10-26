"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import {
  fetchLinks,
  linkContactToCompany,
  setLinkActive,
  setLinkRole,
  type LinkWithRoles,
} from "@/lib/crm/companies";
import { errorMessage } from "@/lib/crm/contacts";
import { LINKS_CHANGED_EVENT, notifyLinksChanged } from "@/lib/crm/phones";
import { formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { CompanyPicker } from "./company-picker";
import { ContactPicker } from "./contact-picker";

type Props =
  | { mode: "contact"; contactId: string; onChanged?: () => void }
  | { mode: "company"; companyId: string; onChanged?: () => void };

/**
 * Vínculos persona–empresa con sus funciones. Desde la persona se ven sus
 * empresas; desde la empresa, sus contactos. Cualquiera puede vincular,
 * desvincular (se desactiva, no se borra) y asignar funciones. Sin permisos
 * de compra: esto es un CRM, no un ERP.
 */
export function CompanyLinks(props: Props) {
  const supabase = createClient();
  const { roles } = useCrm();
  const [links, setLinks] = useState<LinkWithRoles[] | null>(null);
  const [showInactive, setShowInactive] = useState(false);
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
    // Vínculos creados desde otro lugar (aviso del chat, alta con «vincular»).
    const onChanged = () => void load();
    window.addEventListener(LINKS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(LINKS_CHANGED_EVENT, onChanged);
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string, fallback: string): Promise<boolean> {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error, fallback));
      return false;
    }
    toast.success(success);
    notifyLinksChanged(); // recarga esta lista y el aviso del chat
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
            onToggleRole={(roleId, on) => void toggleRole(link, roleId, on)}
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

    </div>
  );
}

function LinkRow({
  link,
  mode,
  onToggleRole,
  onSetActive,
}: {
  link: LinkWithRoles;
  mode: "contact" | "company";
  onToggleRole: (roleId: string, on: boolean) => void;
  onSetActive: (on: boolean) => void;
}) {
  const { roles } = useCrm();
  const roleIds = new Set(link.roles.map((r) => r.id));
  const other =
    mode === "contact"
      ? {
          name: link.company?.trade_name ?? "Empresa",
          sub: null as string | null,
          avatar: <ContactAvatar seed={link.company_id} name={link.company?.trade_name} company={link.company?.trade_name} size="sm" />,
        }
      : {
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
            <span className="truncate font-medium">{other.name}</span>
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
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => onSetActive(!link.is_active)}>
          {link.is_active ? "Desvincular" : "Reactivar"}
        </Button>
      </div>
    </li>
  );
}
