"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { fetchCompany, setCompanyTag, updateCompany, type CompanyWithTags } from "@/lib/crm/companies";
import { errorMessage } from "@/lib/crm/contacts";
import { parseCustomFields, type CustomFields } from "@/lib/crm/types";
import { formatPhone } from "@/lib/format";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { ClassificationControl } from "./classification-control";
import { CompanyLinks } from "./company-links";
import { CustomFieldsEditor } from "./custom-fields-editor";
import { EditableField } from "./editable-field";
import { PhoneField } from "./phone-field";
import { PurchaseCounter } from "./purchase-counter";
import { TagPicker } from "./tag-picker";

type Props = {
  company: CompanyWithTags;
  onCompanyChange: (company: CompanyWithTags) => void;
  inactive?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

/** Mismo estilo de sección que la ficha de la persona. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="text-xs font-bold tracking-wider text-texto uppercase">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Ficha de una empresa para el panel lateral (misma forma que la ficha de la
 * persona): clasificación, datos comerciales con el contador de compras,
 * personas vinculadas con sus funciones, etiquetas y notas generales.
 * Sin historial, pedidos ni saldos (CRM, no ERP).
 */
export function CompanyDetails({ company, onCompanyChange, inactive }: Props) {
  const supabase = createClient();

  async function save(patch: TablesUpdate<"companies">) {
    try {
      onCompanyChange(await updateCompany(supabase, company.id, patch));
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      toast.error(code === "23505" ? "Ya existe otra empresa con ese nombre comercial" : errorMessage(error, "No se pudo guardar la empresa"));
      throw error;
    }
  }

  async function reload() {
    try {
      const fresh = await fetchCompany(supabase, company.id);
      if (fresh) onCompanyChange(fresh);
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo recargar la empresa"));
    }
  }

  async function removeTag(tagId: string) {
    const previous = company.tags;
    onCompanyChange({ ...company, tags: previous.filter((t) => t.id !== tagId) });
    try {
      await setCompanyTag(supabase, company.id, tagId, false);
    } catch (error) {
      onCompanyChange({ ...company, tags: previous });
      toast.error(errorMessage(error, "No se pudo quitar la etiqueta"));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <ContactAvatar seed={company.id} name={company.trade_name} company={company.trade_name} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{company.trade_name}</p>
          {company.phone && <p className="text-[0.9375rem] tabular-nums">{formatPhone(company.phone)}</p>}
          {company.legal_name && <p className="truncate text-sm text-texto-suave">{company.legal_name}</p>}
        </div>
      </div>

      <Section title="Clasificación">
        <ClassificationControl
          entity="company"
          id={company.id}
          classification={company.classification}
          source={company.classification_source}
          classifiedAt={company.classified_at}
          inactive={inactive}
          onChanged={reload}
        />
      </Section>

      <Section title="Datos">
        <div className="space-y-4">
          <EditableField
            icon="empresa"
            label="Nombre comercial"
            value={company.trade_name}
            onSave={async (v) => {
              if (!v) {
                toast.error("El nombre comercial es obligatorio");
                throw new Error("vacío");
              }
              await save({ trade_name: v });
            }}
          />
          {/* Con verificación de duplicados contra personas y otras empresas (update_phone) */}
          <PhoneField owner={{ kind: "company", id: company.id }} label="Teléfono" value={company.phone} onSaved={reload} />
          <EditableField
            icon="correo"
            label="Correo"
            type="email"
            value={company.email}
            validate={(v) => (EMAIL_RE.test(v) ? null : "Correo no válido")}
            onSave={(email) => save({ email })}
          />
          <PurchaseCounter
            entity={{ kind: "company", id: company.id }}
            state={company}
            onChange={(state) => onCompanyChange({ ...company, ...state })}
          />
          <EditableField icon="notas" label="Razón social" value={company.legal_name} onSave={(legal_name) => save({ legal_name })} />
          <EditableField
            icon="notas"
            label="RFC"
            value={company.rfc}
            validate={(v) => (RFC_RE.test(v) ? null : "RFC no válido (12 o 13 caracteres)")}
            onSave={(rfc) => save({ rfc: rfc?.toUpperCase() ?? null })}
          />
          <EditableField icon="ubicacion" label="Dirección" value={company.address} onSave={(address) => save({ address })} />
          <EditableField icon="ubicacion" label="Ciudad" value={company.city} onSave={(city) => save({ city })} />
        </div>
      </Section>

      <Section title="Personas vinculadas">
        <CompanyLinks mode="company" companyId={company.id} />
      </Section>

      <Section title="Etiquetas">
        <div className="flex flex-wrap items-center gap-2">
          {company.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} dot onRemove={() => void removeTag(tag.id)} />
          ))}
          <TagPicker
            target={{ kind: "company", id: company.id }}
            value={company.tags}
            onChange={(tags) => onCompanyChange({ ...company, tags })}
            trigger={
              <Button variant="outline" size="sm" className="h-7 rounded-full px-3">
                <Icon name="agregar" /> Etiqueta
              </Button>
            }
          />
        </div>
      </Section>

      <Section title="Notas generales">
        <EditableField
          icon="notas"
          label="Notas generales"
          hideLabel
          multiline
          value={company.notes}
          placeholder="Información útil sobre la empresa…"
          onSave={(notes) => save({ notes })}
        />
      </Section>

      <Section title="Campos personalizados">
        <CustomFieldsEditor
          fields={parseCustomFields(company.custom_fields)}
          onSave={(fields: CustomFields) => save({ custom_fields: fields })}
        />
      </Section>
    </div>
  );
}
