"use client";

import Link from "next/link";
import { ClassificationBadge } from "@/components/crm/classification-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { entityPanelHref } from "@/lib/crm/contacts";
import type { PhoneDecision, PhoneMatch } from "@/lib/crm/phones";
import { cn } from "@/lib/utils";
import { RolesPicker } from "./roles-picker";

type Props = {
  /** Qué se está guardando: una persona o una empresa. */
  ownerKind: "person" | "company";
  /** Alta («Crear…») o cambio de teléfono («Guardar…»). */
  action: "create" | "edit";
  matches: PhoneMatch[];
  decision: PhoneDecision | null;
  onDecision: (decision: PhoneDecision | null) => void;
  /** Funciones sugeridas al elegir «vincular». */
  defaultRoleIds: string[];
  onCancel: () => void;
};

/** Coincidencias que bloquean: otra PERSONA con el mismo número al guardar una persona. */
export function blockingMatch(ownerKind: "person" | "company", matches: PhoneMatch[]): PhoneMatch | null {
  return ownerKind === "person" ? (matches.find((m) => m.kind === "person") ?? null) : null;
}

/** Coincidencias que requieren elegir una opción antes de guardar (las ya vinculadas no). */
export function pendingMatches(matches: PhoneMatch[]): PhoneMatch[] {
  return matches.filter((m) => !m.is_linked);
}

/** Ficha del registro coincidente (panel lateral de /contactos). */
function hrefFor(match: PhoneMatch, editar = false): string {
  return entityPanelHref(match.kind, match.id, editar);
}

/**
 * Avisos de teléfono repetido con sus opciones:
 *  - persona ↔ persona: bloqueo con «Abrir contacto» / «Editar ese contacto»;
 *  - persona ↔ empresa (en cualquier sentido): vincular (con funciones), guardar de todos modos o cancelar;
 *  - empresa ↔ empresa: posible duplicado con «Abrir esa empresa», guardar de todos modos o cancelar.
 */
export function PhoneConflictPanel({ ownerKind, action, matches, decision, onDecision, defaultRoleIds, onCancel }: Props) {
  const blocking = blockingMatch(ownerKind, matches);
  const verb = action === "create" ? "Crear" : "Guardar";

  if (blocking) {
    return (
      <div role="alert" className="space-y-2 rounded-xl bg-error-suave p-3 text-sm text-error-texto">
        <p className="font-semibold">Este número ya está registrado como {blocking.name}</p>
        <p className="text-xs">Los teléfonos no se repiten entre personas. Si es un fijo compartido, regístralo en la empresa.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={hrefFor(blocking)}>Abrir contacto</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={hrefFor(blocking, true)}>Editar ese contacto</Link>
          </Button>
        </div>
      </div>
    );
  }

  const pending = pendingMatches(matches);
  if (pending.length === 0) return null;

  return (
    <div role="status" className="space-y-3 rounded-xl bg-advertencia-suave p-3 text-sm text-advertencia-texto">
      {pending.map((match) => {
        const crossKind = match.kind !== ownerKind;
        const linking = decision?.mode === "link" && decision.targetId === match.id;
        const title =
          match.kind === "company"
            ? ownerKind === "company"
              ? `Posible duplicado: la empresa ${match.name} tiene este teléfono`
              : `Este número es de la empresa ${match.name}`
            : `Este número ya es de ${match.name}`;
        const linkLabel =
          ownerKind === "company"
            ? "Vincular a esta empresa"
            : action === "create"
              ? "Crear y vincular a esa empresa"
              : "Guardar y vincular a esa empresa";
        return (
          <div key={`${match.kind}-${match.id}`} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Icon name={match.kind === "company" ? "empresa" : "persona"} className="size-4 shrink-0" />
              <p className="font-semibold">{title}</p>
              <ClassificationBadge classification={match.classification} size="xs" />
              {match.has_conversation && <span className="text-xs">· tiene conversación de WhatsApp</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {crossKind ? (
                <Button
                  size="sm"
                  variant={linking ? "default" : "outline"}
                  aria-pressed={linking}
                  onClick={() => onDecision({ mode: "link", targetId: match.id, roleIds: defaultRoleIds })}
                >
                  {linkLabel}
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link href={hrefFor(match)}>Abrir esa empresa</Link>
                </Button>
              )}
              <Button
                size="sm"
                variant={decision?.mode === "anyway" ? "default" : "outline"}
                aria-pressed={decision?.mode === "anyway"}
                onClick={() => onDecision({ mode: "anyway" })}
              >
                {verb} de todos modos
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
            {linking && decision?.mode === "link" && (
              <div className={cn("rounded-lg bg-background p-2 text-texto")}>
                <RolesPicker value={decision.roleIds} onChange={(roleIds) => onDecision({ ...decision, roleIds })} />
                <p className="mt-1.5 text-xs text-texto-suave">
                  El vínculo nace sin permisos de compra; un administrador puede darlos después.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
