"use client";

import { PhoneIcon } from "lucide-react";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { parseCustomFields, type ContactWithTags } from "@/lib/crm/types";
import { formatPhone, telHref } from "@/lib/format";

/**
 * Ficha de SOLO LECTURA para el repartidor: datos de contacto de la persona
 * del chat (teléfono como enlace para llamar). No incluye empresas,
 * clasificación ni compras: el repartidor no las ve (RLS).
 */
export function DeliveryContactCard({ contact }: { contact: ContactWithTags }) {
  const phone = contact.wa_id ?? contact.phone;
  const tel = telHref(phone);
  const extra = Object.entries(parseCustomFields(contact.custom_fields)).filter(([, v]) => v.trim());

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <ContactAvatar seed={contact.wa_id ?? contact.id} name={contact.name} company={contact.company} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{contact.name || formatPhone(phone)}</p>
          {contact.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {contact.tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} size="xs" />
              ))}
            </div>
          )}
        </div>
      </div>

      {tel && (
        <Button asChild className="h-11 w-full">
          <a href={tel}>
            <PhoneIcon aria-hidden /> Llamar a {formatPhone(phone)}
          </a>
        </Button>
      )}

      <dl className="space-y-3 text-sm">
        <Field icon="telefono" label="Teléfono" value={formatPhone(phone)} />
        {contact.phone && contact.wa_id && contact.phone !== contact.wa_id && (
          <Field icon="telefono" label="Otro teléfono" value={formatPhone(contact.phone)} href={telHref(contact.phone)} />
        )}
        {contact.email && <Field icon="correo" label="Correo" value={contact.email} href={`mailto:${contact.email}`} />}
        {extra.map(([key, value]) => (
          <Field key={key} label={key} value={value} />
        ))}
        {contact.notes?.trim() && <Field icon="notas" label="Notas generales" value={contact.notes} />}
      </dl>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  href,
}: {
  icon?: "telefono" | "correo" | "notas";
  label: string;
  value: string;
  href?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon ? <Icon name={icon} className="mt-0.5 size-5 shrink-0 text-texto-suave" /> : <span className="w-5 shrink-0" />}
      <div className="min-w-0">
        <dt className="text-xs font-medium text-texto-suave">{label}</dt>
        <dd className="break-words whitespace-pre-wrap">
          {href ? (
            <a href={href} className="font-medium text-marca-texto hover:underline">
              {value}
            </a>
          ) : (
            value
          )}
        </dd>
      </div>
    </div>
  );
}
