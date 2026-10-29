// Tipos (parciales) del payload que envía el webhook de WhatsApp Cloud API.
// Solo se declaran los campos que usamos; Meta puede enviar más.

export type WaMedia = {
  id: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
  sha256?: string;
  /** Audio: true si es una nota de voz (ogg/opus). */
  voice?: boolean;
  /** Sticker: true si es animado. */
  animated?: boolean;
};

export type WaInboundMessage = {
  from: string;
  id: string;
  timestamp: string; // segundos Unix como string
  type: string;
  text?: { body: string };
  image?: WaMedia;
  video?: WaMedia;
  audio?: WaMedia;
  document?: WaMedia;
  sticker?: WaMedia;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  reaction?: { message_id: string; emoji?: string };
  contacts?: {
    name?: { formatted_name?: string; first_name?: string };
    phones?: { phone?: string; wa_id?: string; type?: string }[];
  }[];
  /** Anuncio de clic a WhatsApp que originó el mensaje (si lo hay). */
  referral?: {
    source_url?: string;
    source_type?: string;
    source_id?: string;
    headline?: string;
    body?: string;
    media_type?: string;
    image_url?: string;
    video_url?: string;
    thumbnail_url?: string;
    ctwa_clid?: string;
  };
  order?: { product_items?: { product_retailer_id?: string; quantity?: number }[]; text?: string };
  errors?: { code: number; title?: string }[];
  button?: { text: string; payload?: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
};

export type WaStatusError = {
  code: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
};

export type WaStatus = {
  id: string; // wa_message_id del mensaje saliente
  status: "sent" | "delivered" | "read" | "failed" | (string & {});
  timestamp: string;
  recipient_id: string;
  errors?: WaStatusError[];
};

export type WaChangeValue = {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: WaInboundMessage[];
  statuses?: WaStatus[];
};

export type WaWebhookPayload = {
  object: string;
  entry?: {
    id: string;
    changes?: { field: string; value: WaChangeValue }[];
  }[];
};
