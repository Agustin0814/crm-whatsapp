// Datos estructurados de mensajes (ubicaciones y contactos compartidos) y
// del anuncio de origen. Lógica pura: la usan el webhook (para guardar) y el
// chat (para mostrar). Todo lo que viene de Meta se valida y se recorta.

import type { Json } from "@/lib/supabase/database.types";

export type MessageLocation = { latitude: number; longitude: number; name?: string; address?: string };
export type SharedContactPhone = { phone: string; wa_id?: string };
export type SharedContact = { name: string; phones: SharedContactPhone[] };

const MAX_TEXT = 200;
const MAX_CONTACTS = 10;
const MAX_PHONES = 5;

function text(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().slice(0, max);
  return clean || undefined;
}

function coordinate(value: unknown, limit: number): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** Ubicación válida (coordenadas en rango) o null. Sirve para el payload y para messages.location. */
export function parseLocation(raw: unknown): MessageLocation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const latitude = coordinate(o.latitude, 90);
  const longitude = coordinate(o.longitude, 180);
  if (latitude === null || longitude === null) return null;
  const location: MessageLocation = { latitude, longitude };
  const name = text(o.name);
  const address = text(o.address, 300);
  if (name) location.name = name;
  if (address) location.address = address;
  return location;
}

/** Contactos compartidos (payload de Meta o messages.shared_contacts). */
export function parseSharedContacts(raw: unknown): SharedContact[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_CONTACTS).flatMap((c) => {
    if (!c || typeof c !== "object") return [];
    const o = c as Record<string, unknown>;
    // Payload de Meta: {name: {formatted_name}, phones: [{phone, wa_id}]}; guardado: {name, phones}.
    const nameObj = o.name && typeof o.name === "object" ? (o.name as Record<string, unknown>) : null;
    const name = text(nameObj ? (nameObj.formatted_name ?? nameObj.first_name) : o.name) ?? "";
    const phones = (Array.isArray(o.phones) ? o.phones : []).slice(0, MAX_PHONES).flatMap((p) => {
      if (!p || typeof p !== "object") return [];
      const po = p as Record<string, unknown>;
      const phone = text(po.phone, 40);
      const waId = text(po.wa_id, 20)?.replace(/\D/g, "");
      if (!phone && !waId) return [];
      return [{ phone: phone ?? waId!, ...(waId ? { wa_id: waId } : {}) }];
    });
    if (!name && phones.length === 0) return [];
    return [{ name, phones }];
  });
}

/** Datos del anuncio de clic a WhatsApp (message.referral): solo campos conocidos y recortados. */
export function parseReferral(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  const fields: [string, number][] = [
    ["source_url", 500],
    ["source_type", 40],
    ["source_id", 100],
    ["headline", 200],
    ["body", 500],
    ["media_type", 40],
    ["ctwa_clid", 200],
  ];
  for (const [key, max] of fields) {
    const value = text(o[key], max);
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Enlace de Google Maps con coordenadas (sin claves ni librerías). */
export function mapsUrlForCoords(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Enlace de Google Maps con una dirección escrita. */
export function mapsUrlForAddress(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Coordenadas legibles: «27.94997, -110.92496». */
export function formatCoords(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/** Para guardar en jsonb sin perder el tipo. */
export function toJson<T>(value: T): Json {
  return value as unknown as Json;
}

// --- Origen del contacto -------------------------------------------------------

export const CONTACT_SOURCES = ["anuncio", "recomendacion", "redes", "llamada", "visita", "otro"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export const SOURCE_LABELS: Record<ContactSource, string> = {
  anuncio: "Anuncio",
  recomendacion: "Recomendación",
  redes: "Redes sociales",
  llamada: "Llamada",
  visita: "Visita",
  otro: "Otro",
};

export function isContactSource(value: unknown): value is ContactSource {
  return typeof value === "string" && (CONTACT_SOURCES as readonly string[]).includes(value);
}
