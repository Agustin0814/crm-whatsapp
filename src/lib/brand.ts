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
/**
 * Geometría medida de cada logo (fracciones del ancho/alto de la imagen),
 * obtenida dibujando cada SVG en un canvas y buscando los píxeles opacos.
 * Sirve para que, en la barra lateral, el cubo quede SIEMPRE fijo y al abrirla
 * solo aparezca el texto del logo completo, alineado como en el original.
 * Si se cambian los archivos de logo, hay que volver a medir.
 */
export const LOGO_GEOMETRY = {
  icono: { cubeX0: 0.118, cubeX1: 0.885, cubeY0: 0.072, cubeY1: 0.945 },
  fondoClaro: { ratio: 0.28, cubeX1: 0.2227, textX0: 0.2867, cubeY0: 0.1048, cubeY1: 0.9667 },
  fondoOscuro: { ratio: 0.28, cubeX1: 0.2153, textX0: 0.2807, cubeY0: 0.1214, cubeY1: 0.9286 },
} as const;

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
