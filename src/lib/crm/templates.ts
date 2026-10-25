import type { Contact } from "./types";

/** Variables disponibles en las respuestas rápidas. */
export const TEMPLATE_VARIABLES = [
  { key: "nombre", description: "Nombre del contacto (o su número si no tiene nombre)" },
  { key: "primer_nombre", description: "Solo el primer nombre" },
  { key: "telefono", description: "Teléfono del contacto" },
  { key: "empresa", description: "Empresa del contacto" },
] as const;

/**
 * Reemplaza {{variable}} con datos del contacto. Las variables desconocidas
 * o sin valor se dejan vacías para no enviar llaves al cliente.
 */
export function applyTemplate(
  body: string,
  contact: Pick<Contact, "name" | "wa_id" | "phone" | "company"> | null,
): string {
  const name = contact?.name?.trim() || (contact ? `+${contact.wa_id}` : "");
  const values: Record<string, string> = {
    nombre: name,
    primer_nombre: contact?.name?.trim().split(/\s+/)[0] ?? "",
    telefono: contact?.phone || contact?.wa_id || "",
    empresa: contact?.company ?? "",
  };
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => values[key.toLowerCase()] ?? "");
}
