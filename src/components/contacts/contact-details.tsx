"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { errorMessage, fetchContact, setContactTag, updateContact } from "@/lib/crm/contacts";
import { parseCustomFields, type ContactWithTags, type CustomFields } from "@/lib/crm/types";
import { formatDate, formatPhone } from "@/lib/format";
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
  contact: ContactWithTags;
  onContactChange: (contact: ContactWithTags) => void;
  /** Acciones extra bajo el encabezado (p. ej. «Abrir chat» en /contactos). */
  actions?: ReactNode;
  /**
   * false = la persona no tiene conversación de WhatsApp (creada a mano): las
   * notas internas viven en el chat, así que solo tiene las notas generales.
   */
  hasConversation?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3 border-t pt-5">
      <h3 className="text-xs font-bold tracking-wider text-texto uppercase">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Ficha del contacto con edición en línea y guardado automático.
 * El nombre editado aquí no lo pisa el webhook (solo completa nombres vacíos).
 */
export function ContactDetails({ contact, onContactChange, actions, hasConversation = true }: Props) {
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

  async function reload() {
    try {
      onContactChange(await fetchContact(supabase, contact.id));
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo recargar el contacto"));
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

  // Un contacto creado a mano puede no tener WhatsApp: se usa su teléfono.
  const phone = contact.wa_id ?? contact.phone;
  const displayName = contact.name || formatPhone(phone);

  return (
    <div className="space-y-5">
      {/* Encabezado: avatar grande, nombre y teléfono legible */}
      <div className="flex items-center gap-4">
        <ContactAvatar seed={contact.wa_id ?? contact.id} name={contact.name} company={contact.company} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{displayName}</p>
          <p className="text-[0.9375rem] tabular-nums">{formatPhone(phone)}</p>
          {contact.company && <p className="truncate text-sm text-texto-suave">{contact.company}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

      <Section title="Clasificación">
        <ClassificationControl
          entity="contact"
          id={contact.id}
          classification={contact.classification}
          source={contact.classification_source}
          classifiedAt={contact.classified_at}
          onChanged={reload}
        />
      </Section>

      <Section title="Etiquetas">
        <div className="flex flex-wrap items-center gap-2">
          {contact.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} dot onRemove={() => void removeTag(tag.id)} />
          ))}
          <TagPicker
            target={{ kind: "contact", id: contact.id }}
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

      <Section title="Datos" id="datos-contacto">
        <div className="space-y-4">
          <EditableField icon="persona" label="Nombre" value={contact.name} onSave={(name) => save({ name })} />
          {/* El teléfono se guarda con verificación de duplicados (update_phone) */}
          <PhoneField owner={{ kind: "person", id: contact.id }} label="Teléfono" value={contact.phone} onSaved={reload} />
          {/* Contador de compras: + / − / número (qué compró va en una nota interna del chat) */}
          <PurchaseCounter
            entity={{ kind: "contact", id: contact.id }}
            state={contact}
            onChange={(state) => onContactChange({ ...contact, ...state })}
          />
          <EditableField
            icon="correo"
            label="Correo"
            type="email"
            value={contact.email}
            onSave={(email) => save({ email })}
            validate={(v) => (EMAIL_RE.test(v) ? null : "Correo no válido")}
          />
        </div>
      </Section>

      <Section title="Empresas y funciones">
        {/* contacts.company es texto heredado: se muestra, pero la relación real son los vínculos */}
        {contact.company && (
          <p className="text-xs text-texto-suave">Empresa anotada antes: {contact.company}</p>
        )}
        <CompanyLinks mode="contact" contactId={contact.id} />
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
        {!hasConversation && (
          <p className="text-xs text-texto-suave">
            Sin conversación de WhatsApp: las notas internas con fecha se escriben en el chat; aquí solo hay notas generales.
          </p>
        )}
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
