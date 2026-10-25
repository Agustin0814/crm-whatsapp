/* eslint-disable @next/next/no-img-element --
 * Los logos son SVG pesados con PNG incrustados en base64: se cargan tal cual
 * con <img> (sin la optimización de next/image, que no aporta nada a un SVG) y
 * nunca se incrustan en el bundle. */
import { APP_NAME, BRAND_ASSETS } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Logo de la barra lateral (fondo siempre oscuro).
 * <picture> elige UNA sola imagen según el ancho: el icono cuando la barra está
 * contraída (< 1280 px) y el logo completo de texto blanco cuando está expandida.
 * El navegador solo descarga la que corresponde.
 */
export function SidebarLogo({ className }: { className?: string }) {
  return (
    <picture className={cn("block", className)}>
      <source media="(min-width: 1280px)" srcSet={BRAND_ASSETS.logoFondoOscuro} width={750} height={210} />
      <img
        src={BRAND_ASSETS.logoIcono}
        alt={APP_NAME}
        width={40}
        height={40}
        decoding="async"
        className="size-10 object-contain xl:h-12 xl:w-auto"
      />
    </picture>
  );
}

/** Icono de la marca (login, estados especiales). */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <img
      src={BRAND_ASSETS.logoIcono}
      alt=""
      aria-hidden
      width={48}
      height={48}
      decoding="async"
      className={cn("size-12 object-contain", className)}
    />
  );
}

/**
 * Logo completo según el FONDO sobre el que va. Se decide desde fuera (no se
 * renderizan las dos versiones ocultando una, para no descargar ambas).
 */
export function BrandWordmark({ background, className }: { background: "claro" | "oscuro"; className?: string }) {
  return (
    <img
      src={background === "oscuro" ? BRAND_ASSETS.logoFondoOscuro : BRAND_ASSETS.logoFondoClaro}
      alt={APP_NAME}
      width={750}
      height={210}
      decoding="async"
      className={cn("h-12 w-auto object-contain", className)}
    />
  );
}
