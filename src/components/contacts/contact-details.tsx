"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { errorMessage, setContactTag, updateContact } from "@/lib/crm/contacts";
import { parseCustomFields, type ContactWithTags, type CustomFields } from "@/lib/crm/types";
import { formatDate, formatPhone } from "@/lib/format";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { CustomFieldsEditor } from "./custom-fields-editor";
import { EditableField } from "./editable-field";
import { TagPicker } from "./tag-picker";

type Props = {
  contact: ContactWithTags;
  onContactChange: (contact: ContactWithTags) => void;
  /** Acciones extra bajo el encabezado (p. ej. «Abrir conversación»). */
  actions?: ReactNode;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="text-xs font-bold tracking-wider text-texto uppercase">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Ficha del contacto con edición en línea y guardado automático.
 * El nombre editado aquí no lo pisa el webhook (solo completa nombres vacíos).
 */
export function ContactDetails({ contact, onContactChange, actions }: Props) {
  const supabase = createClient();

  async function save(patch: TablesUpdate<"contacts">) {
    try {
      const updated = await updateContact(supabase, contact.id, patch);
      onContactChange(updated);
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo guardar el contacto"));
      throw error;
    }
  }

  async function saveCustomFields(fields: CustomFields) {
    await save({ custom_fields: fields });
  }

  async function removeTag(tagId: string) {
    const previous = contact.tags;
    onContactChange({ ...contact, tags: previous.filter((t) => t.id !== tagId) });
    try {
      await setContactTag(supabase, contact.id, tagId, false);
    } catch (error) {
      onContactChange({ ...contact, tags: previous });
      toast.error(errorMessage(error, "No se pudo quitar la etiqueta"));
    }
  }

  const displayName = contact.name || formatPhone(contact.wa_id);

  return (
    <div className="space-y-5">
      {/* Encabezado: avatar grande, nombre y teléfono legible */}
      <div className="flex items-center gap-4">
        <ContactAvatar seed={contact.wa_id} name={contact.name} company={contact.company} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{displayName}</p>
          <p className="text-[0.9375rem] tabular-nums">{formatPhone(contact.wa_id)}</p>
          {contact.company && <p className="truncate text-sm text-texto-suave">{contact.company}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

      <Section title="Etiquetas">
        <div className="flex flex-wrap items-center gap-2">
          {contact.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} dot onRemove={() => void removeTag(tag.id)} />
          ))}
          <TagPicker
            contactId={contact.id}
            value={contact.tags}
            onChange={(tags) => onContactChange({ ...contact, tags })}
            trigger={
              <Button variant="outline" size="sm" className="h-7 rounded-full px-3">
                <Icon name="agregar" /> Etiqueta
              </Button>
            }
          />
        </div>
      </Section>

      <Section title="Datos">
        <div className="space-y-4">
          <EditableField icon="persona" label="Nombre" value={contact.name} onSave={(name) => save({ name })} />
          <EditableField
            icon="telefono"
            label="Teléfono"
            type="tel"
            value={contact.phone}
            format={formatPhone}
            onSave={(phone) => save({ phone })}
          />
          <EditableField
            icon="correo"
            label="Correo"
            type="email"
            value={contact.email}
            onSave={(email) => save({ email })}
            validate={(v) => (EMAIL_RE.test(v) ? null : "Correo no válido")}
          />
          <EditableField icon="empresa" label="Empresa" value={contact.company} onSave={(company) => save({ company })} />
        </div>
      </Section>

      <Section title="Notas generales">
        <EditableField
          icon="notas"
          label="Notas generales"
          hideLabel
          multiline
          value={contact.notes}
          placeholder="Información útil sobre el contacto…"
          onSave={(notes) => save({ notes })}
        />
      </Section>

      <Section title="Campos personalizados">
        <CustomFieldsEditor fields={parseCustomFields(contact.custom_fields)} onSave={saveCustomFields} />
      </Section>

      <footer className="grid grid-cols-2 gap-4 border-t pt-5 text-sm">
        <div className="flex items-start gap-2">
          <Icon name="reloj" className="mt-0.5 size-4 text-texto-suave" />
          <div>
            <p className="text-xs text-texto-suave">Creado</p>
            <p className="tabular-nums">{formatDate(contact.created_at)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-texto-suave">Actualizado</p>
          <p className="tabular-nums">{formatDate(contact.updated_at)}</p>
        </div>
      </footer>
    </div>
  );
}
