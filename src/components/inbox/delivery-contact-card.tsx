"use client";

import { ExternalLinkIcon, PhoneIcon } from "lucide-react";
import { deliveryMapsUrl } from "@/components/contacts/delivery-section";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { parseCustomFields, type ContactWithTags } from "@/lib/crm/types";
import { formatCoords, SOURCE_LABELS, isContactSource } from "@/lib/crm/message-data";
import { formatPhone, telHref } from "@/lib/format";

/**
 * Ficha de SOLO LECTURA para el repartidor: datos de entrega (dirección,
 * referencias, Maps) y de contacto de la persona del chat (teléfono tel:).
 * No incluye empresas, clasificación ni compras: el repartidor no las ve (RLS).
 */
export function DeliveryContactCard({ contact }: { contact: ContactWithTags }) {
  const phone = contact.wa_id ?? contact.phone;
  const tel = telHref(phone);
  const extra = Object.entries(parseCustomFields(contact.custom_fields)).filter(([, v]) => v.trim());
  const mapsUrl = deliveryMapsUrl(contact);

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

      <div className="grid gap-2 sm:grid-cols-2">
        {tel && (
          <Button asChild className="h-11 w-full">
            <a href={tel}>
              <PhoneIcon aria-hidden /> Llamar
            </a>
          </Button>
        )}
        {mapsUrl && (
          <Button asChild variant="outline" className="h-11 w-full">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon aria-hidden /> Abrir en Maps
            </a>
          </Button>
        )}
      </div>

      <dl className="space-y-3 text-sm">
        <Field icon="ubicacion" label="Dirección de entrega" value={contact.delivery_address?.trim() || "Sin dirección"} />
        {contact.delivery_references?.trim() && (
          <Field icon="info" label="Referencias" value={contact.delivery_references} />
        )}
        {contact.delivery_lat !== null && contact.delivery_lng !== null && (
          <Field label="Ubicación" value={formatCoords(contact.delivery_lat, contact.delivery_lng)} href={mapsUrl} external />
        )}
        <Field icon="telefono" label="Teléfono" value={formatPhone(phone)} href={tel} />
        {contact.phone && contact.wa_id && contact.phone !== contact.wa_id && (
          <Field icon="telefono" label="Otro teléfono" value={formatPhone(contact.phone)} href={telHref(contact.phone)} />
        )}
        {contact.email && <Field icon="correo" label="Correo" value={contact.email} href={`mailto:${contact.email}`} />}
        {extra.map(([key, value]) => (
          <Field key={key} label={key} value={value} />
        ))}
        {contact.notes?.trim() && <Field icon="notas" label="Notas generales" value={contact.notes} />}
        {isContactSource(contact.source) && <Field label="Origen" value={SOURCE_LABELS[contact.source]} />}
      </dl>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon?: "telefono" | "correo" | "notas" | "ubicacion" | "info";
  label: string;
  value: string;
  href?: string | null;
  /** Enlace a otro sitio (Maps): pestaña nueva sin acceso a esta página. */
  external?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon ? <Icon name={icon} className="mt-0.5 size-5 shrink-0 text-texto-suave" /> : <span className="w-5 shrink-0" />}
      <div className="min-w-0">
        <dt className="text-xs font-medium text-texto-suave">{label}</dt>
        <dd className="break-words whitespace-pre-wrap">
          {href ? (
            <a
              href={href}
              className="font-medium text-marca-texto hover:underline"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
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
