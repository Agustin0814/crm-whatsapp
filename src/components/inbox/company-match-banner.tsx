"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RolesPicker, useDefaultRoleIds } from "@/components/contacts/roles-picker";
import { useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { errorMessage } from "@/lib/crm/contacts";
import {
  dismissPhoneMatch,
  fetchCompanyPhoneMatches,
  LINKS_CHANGED_EVENT,
  linkWithRoles,
  notifyLinksChanged,
} from "@/lib/crm/phones";
import { createClient } from "@/lib/supabase/client";

type Match = { company_id: string; trade_name: string; classification: string };

type Props = {
  contactId: string;
  /** Cambia si cambia el teléfono del contacto (vuelve a buscar). */
  phoneKey: string;
};

/**
 * «Este número coincide con el teléfono de la empresa X»: aparece cuando la
 * persona tiene el mismo teléfono que una empresa con la que NO está
 * vinculada. Nunca vincula solo: el agente elige funciones y vincula, o
 * descarta (el descarte se guarda por par persona–empresa y no vuelve a salir).
 */
export function CompanyMatchBanner({ contactId, phoneKey }: Props) {
  const supabase = createClient();
  const { me } = useCrm();
  const defaultRoleIds = useDefaultRoleIds();
  const [matches, setMatches] = useState<Match[]>([]);
  const [linking, setLinking] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCompanyPhoneMatches(supabase, contactId)
      .then((rows) => {
        if (!cancelled) setMatches(rows);
      })
      .catch(() => undefined); // aviso opcional: sin errores molestos
    return () => {
      cancelled = true;
    };
  }, [supabase, contactId, phoneKey, version]);

  // Si se vincula desde la ficha (u otro lugar), el aviso se vuelve a evaluar.
  useEffect(() => {
    const onChanged = () => setVersion((v) => v + 1);
    window.addEventListener(LINKS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(LINKS_CHANGED_EVENT, onChanged);
  }, []);

  const match = matches[0];
  if (!match) return null;

  async function link() {
    if (!match || !linking) return;
    setBusy(true);
    try {
      await linkWithRoles(supabase, contactId, match.company_id, linking);
      toast.success(`Vinculado a ${match.trade_name}`, { description: "Sin permisos de compra: los da un administrador." });
      setLinking(null);
      notifyLinksChanged(); // recarga este aviso y las listas de vínculos
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo vincular"));
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (!match || !me) return;
    setBusy(true);
    try {
      await dismissPhoneMatch(supabase, contactId, match.company_id, me.id);
      setMatches((prev) => prev.filter((m) => m.company_id !== match.company_id));
      setLinking(null);
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo descartar"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="space-y-2 border-b bg-advertencia-suave px-4 py-2.5 text-sm text-advertencia-texto">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon name="empresa" className="size-4 shrink-0" />
        <p className="min-w-0 flex-1">
          Este número coincide con el teléfono de la empresa <span className="font-semibold">{match.trade_name}</span>.
          ¿Vincular como contacto?
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setLinking(linking ? null : defaultRoleIds)} disabled={busy} aria-expanded={linking !== null}>
            Vincular
          </Button>
          <Button size="sm" variant="outline" onClick={() => void dismiss()} disabled={busy}>
            Descartar
          </Button>
        </div>
      </div>
      {linking && (
        <div className="space-y-2 rounded-lg bg-background p-3 text-texto">
          <RolesPicker value={linking} onChange={setLinking} />
          <p className="text-xs text-texto-suave">El vínculo nace sin permisos de compra.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void link()} disabled={busy}>
              {busy ? "Vinculando…" : `Vincular a ${match.trade_name}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLinking(null)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
