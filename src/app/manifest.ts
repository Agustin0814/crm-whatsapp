import type { MetadataRoute } from "next";
import { APP_NAME, BRAND_ASSETS, BRAND_COLOR, SIDEBAR_COLOR } from "@/lib/brand";

/** Manifest de la app instalable (se sirve en /manifest.webmanifest). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "LG Blocks",
    description: "Bandeja de mensajes de WhatsApp Business",
    start_url: "/",
    display: "standalone",
    background_color: SIDEBAR_COLOR,
    theme_color: BRAND_COLOR,
    lang: "es",
    icons: [
      { src: BRAND_ASSETS.icon192, sizes: "192x192", type: "image/png" },
      { src: BRAND_ASSETS.icon512, sizes: "512x512", type: "image/png" },
    ],
  };
}
