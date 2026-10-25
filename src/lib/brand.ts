// Constantes de marca compartidas (metadatos, manifest, interfaz).

export const APP_NAME = "LG Blocks CRM";

/** Naranja de marca medido en la maqueta (también está como token --marca). */
export const BRAND_COLOR = "#EC5E2A";

/** Fondo de la barra lateral (token --lateral), usado como background del manifest. */
export const SIDEBAR_COLOR = "#151A23";

/** Nombre de la sucursal que se muestra en la barra lateral. */
export const BUSINESS_LABEL = process.env.NEXT_PUBLIC_BUSINESS_LABEL?.trim() || "Planta Guaymas";

/**
 * Recursos originales en public/ (no se modifican).
 *
 * OJO con los nombres de los logos: se verificó su contenido (decodificando los
 * PNG incrustados y mirándolos sobre fondo oscuro) y están al revés de lo que
 * sugiere su nombre:
 *   logo-lg-blocks-oscuro.svg → texto BLANCO → para fondos oscuros;
 *   logo-lg-blocks-claro.svg  → texto gris pizarra oscuro → para fondos claros.
 * Por eso aquí se nombran por el fondo en el que se usan.
 */
export const BRAND_ASSETS = {
  logoFondoOscuro: "/brand/logo-lg-blocks-oscuro.svg",
  logoFondoClaro: "/brand/logo-lg-blocks-claro.svg",
  logoIcono: "/brand/logo-icono.svg",
  icon192: "/brand/icon-192.png",
  icon512: "/brand/icon-512.png",
  favicon32: "/brand/favicon-32.png",
  appleTouch: "/brand/apple-touch-icon.png",
  sonidoNotificacion: "/sounds/notificacion.mp3",
} as const;
