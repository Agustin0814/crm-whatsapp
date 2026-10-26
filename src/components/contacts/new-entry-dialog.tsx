"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setClassification } from "@/lib/crm/classification";
import { errorMessage } from "@/lib/crm/contacts";
import {
  createCompanyChecked,
  createPerson,
  notifyLinksChanged,
  type PhoneDecision,
  type PhoneMatch,
} from "@/lib/crm/phones";
import { CLASSIFICATION_LABELS, type Classification } from "@/lib/crm/types";
import { notifyContactsChanged } from "@/lib/crm/purchases";
import { createClient } from "@/lib/supabase/client";
import { blockingMatch, PhoneConflictPanel, pendingMatches } from "./phone-conflict-panel";
import { useDefaultRoleIds } from "./roles-picker";
import { usePhoneMatches } from "./use-phone-matches";

export type NewEntryPreset = { kind: "person" | "company"; classification: Classification };

type Props = {
  preset: NewEntryPreset | null;
  onClose: () => void;
  /** Tras crear: abre su ficha en el panel lateral (sin cambiar de página). */
  onCreated: (kind: "person" | "company", id: string) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Alta manual de una persona o una empresa (un proveedor es cualquiera de las
 * dos con clasificación «Proveedor»). El teléfono se verifica mientras se
 * escribe y otra vez en la base al guardar (`create_person` / `create_company`).
 * Tras crearla se abre su ficha en el panel lateral.
 */
export function NewEntryDialog({ preset, onClose, onCreated }: Props) {
  const supabase = createClient();
  const defaultRoleIds = useDefaultRoleIds();
  const [kind, setKind] = useState<"person" | "company">("person");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [decision, setDecision] = useState<PhoneDecision | null>(null);
  // Coincidencias que devolvió el servidor al intentar guardar (más recientes que las del aviso).
  const [serverMatches, setServerMatches] = useState<{ phone: string; matches: PhoneMatch[] } | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicia el formulario al abrir con otro preset (estado derivado, sin efecto).
  const [seen, setSeen] = useState<NewEntryPreset | null>(null);
  if (preset !== seen) {
    setSeen(preset);
    if (preset) {
      setKind(preset.kind);
      setName("");
      setPhone("");
      setEmail("");
      setDecision(null);
      setServerMatches(null);
    }
  }

  const live = usePhoneMatches(phone, { kind }, preset !== null);
  const matches = serverMatches?.phone === phone ? serverMatches.matches : live.matches;
  const blocking = blockingMatch(kind, matches);
  const pending = pendingMatches(matches);
  const needsDecision = !blocking && pending.length > 0 && decision === null;

  const classification = preset?.classification ?? "unclassified";
  const emailInvalid = email.trim() !== "" && !EMAIL_RE.test(email.trim());
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneInvalid = phone.trim() !== "" && phoneDigits.length < 10;
  const canSave = name.trim() !== "" && !emailInvalid && !phoneInvalid && !blocking && !needsDecision && !saving;

  function changePhone(value: string) {
    setPhone(value);
    setDecision(null); // otra coincidencia, otra decisión
  }

  function changeKind(value: "person" | "company") {
    setKind(value);
    setDecision(null);
    setServerMatches(null);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const values = { name: name.trim(), phone: phone.trim(), email: email.trim() };
      const result =
        kind === "company"
          ? await createCompanyChecked(supabase, values, matches, decision)
          : await createPerson(supabase, values, matches, decision);

      if (result.status === "blocked") {
        setServerMatches({ phone, matches: [result.match] });
        return;
      }
      if (result.status === "needs_confirmation") {
        // El servidor encontró coincidencias que no se habían mostrado: se piden de nuevo.
        setServerMatches({ phone, matches: result.matches });
        setDecision(null);
        toast.warning("Hay registros con ese teléfono: elige una opción antes de guardar");
        return;
      }
      if (result.status === "name_taken") {
        toast.error(`Ya existe una empresa llamada «${values.name}»`);
        return;
      }
      if (result.status !== "created") return;

      if (classification !== "unclassified") {
        await setClassification(supabase, kind === "company" ? "company" : "contact", result.id, classification, "Alta manual");
      }
      if (decision?.mode === "link") notifyLinksChanged();
      toast.success(
        `${kind === "company" ? "Empresa" : "Persona"} «${values.name}» creada${decision?.mode === "link" ? " y vinculada" : ""}`,
      );
      onClose();
      notifyContactsChanged();
      onCreated(kind, result.id);
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo crear"));
    } finally {
      setSaving(false);
    }
  }

  const title =
    classification === "supplier" ? "Nuevo proveedor" : kind === "company" ? "Nueva empresa" : "Nueva persona";

  return (
    <Dialog open={preset !== null} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {classification !== "unclassified"
              ? `Se creará con la clasificación «${CLASSIFICATION_LABELS[classification]}». `
              : ""}
            Después podrás completar la ficha. Los teléfonos no se repiten entre personas; un fijo compartido va en la
            empresa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ToggleGroup
            type="single"
            variant="outline"
            value={kind}
            onValueChange={(v) => v && changeKind(v as "person" | "company")}
            aria-label="Tipo"
            className="w-full"
          >
            <ToggleGroupItem value="person" className="flex-1">
              Persona
            </ToggleGroupItem>
            <ToggleGroupItem value="company" className="flex-1">
              Empresa
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">{kind === "company" ? "Nombre comercial" : "Nombre"}</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-phone">Teléfono (opcional)</Label>
            <Input
              id="new-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => changePhone(e.target.value)}
              onBlur={live.checkNow}
              placeholder="644 123 4567"
              aria-invalid={phoneInvalid || blocking !== null}
            />
            {phoneInvalid && <p className="text-xs text-error-texto">Escribe al menos 10 dígitos.</p>}
            {live.checking && <p className="text-xs text-texto-suave">Verificando teléfono…</p>}
          </div>
          <PhoneConflictPanel
            ownerKind={kind}
            action="create"
            matches={matches}
            decision={decision}
            onDecision={setDecision}
            defaultRoleIds={defaultRoleIds}
            onCancel={onClose}
          />
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Correo (opcional)</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={emailInvalid}
            />
            {emailInvalid && <p className="text-xs text-error-texto">Correo no válido.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {saving
              ? "Creando…"
              : decision?.mode === "link"
                ? "Crear y vincular"
                : decision?.mode === "anyway"
                  ? "Crear de todos modos"
                  : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
