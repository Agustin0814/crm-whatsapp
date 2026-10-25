"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setClassification } from "@/lib/crm/classification";
import { createCompany } from "@/lib/crm/companies";
import { errorMessage, isUniqueViolation } from "@/lib/crm/contacts";
import { CLASSIFICATION_LABELS, type Classification } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { notifyDuplicatePhone } from "./duplicate-phone";

export type NewEntryPreset = { kind: "person" | "company"; classification: Classification };

type Props = {
  preset: NewEntryPreset | null;
  onClose: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Alta manual de una persona o una empresa (un proveedor es cualquiera de las
 * dos con clasificación «Proveedor»). Tras crearla se abre su ficha completa
 * para vincular empresas, funciones, etiquetas, etc.
 */
export function NewEntryDialog({ preset, onClose }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [kind, setKind] = useState<"person" | "company">("person");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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
    }
  }

  const classification = preset?.classification ?? "unclassified";
  const emailInvalid = email.trim() !== "" && !EMAIL_RE.test(email.trim());
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneInvalid = phone.trim() !== "" && phoneDigits.length < 10;
  const canSave = name.trim() !== "" && !emailInvalid && !phoneInvalid && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      let href: string;
      if (kind === "company") {
        const company = await createCompany(supabase, {
          trade_name: name.trim().replace(/\s+/g, " "),
          phone: phone.trim() || null,
          email: email.trim() || null,
        });
        if (classification !== "unclassified") {
          await setClassification(supabase, "company", company.id, classification, "Alta manual");
        }
        href = `/contactos/empresa/${company.id}`;
      } else {
        const { data, error } = await supabase
          .from("contacts")
          .insert({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null })
          .select("id")
          .single();
        if (error) throw error;
        if (classification !== "unclassified") {
          await setClassification(supabase, "contact", data.id, classification, "Alta manual");
        }
        href = `/contactos/persona/${data.id}`;
      }
      toast.success(`${kind === "company" ? "Empresa" : "Persona"} «${name.trim()}» creada`);
      onClose();
      router.push(href);
    } catch (error) {
      if (isUniqueViolation(error) && kind === "person" && phone.trim()) {
        await notifyDuplicatePhone(supabase, phone, (href) => router.push(href));
      } else if (isUniqueViolation(error) && kind === "company") {
        toast.error(`Ya existe una empresa llamada «${name.trim()}»`);
      } else {
        toast.error(errorMessage(error, "No se pudo crear"));
      }
    } finally {
      setSaving(false);
    }
  }

  const title =
    classification === "supplier" ? "Nuevo proveedor" : kind === "company" ? "Nueva empresa" : "Nueva persona";

  return (
    <Dialog open={preset !== null} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent>
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
            onValueChange={(v) => v && setKind(v as "person" | "company")}
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
              onChange={(e) => setPhone(e.target.value)}
              placeholder="644 123 4567"
              aria-invalid={phoneInvalid}
            />
            {phoneInvalid && <p className="text-xs text-error-texto">Escribe al menos 10 dígitos.</p>}
          </div>
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
            {saving ? "Creando…" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
