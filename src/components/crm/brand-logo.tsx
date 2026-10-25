/* eslint-disable @next/next/no-img-element --
 * Los logos son SVG con PNG incrustados en base64: se cargan tal cual con <img>
 * (la optimización de next/image no aporta nada a un SVG) y nunca se
 * incrustan en el bundle. */
import { APP_NAME, BRAND_ASSETS, LOGO_GEOMETRY } from "@/lib/brand";
import { cn } from "@/lib/utils";

/*
 * Cómo se evita el parpadeo y el desajuste de hidratación: NO se elige el logo
 * con estado de JavaScript. Se renderizan las dos versiones y el CSS muestra la
 * que corresponde al tema activo (`dark:hidden` / `hidden dark:block`; la clase
 * .dark la pone next-themes en <html> antes de pintar). Las dos llevan
 * loading="lazy": el navegador no descarga una imagen con display:none, así que
 * la versión oculta solo se pide si el usuario cambia de tema.
 */

/** Logo completo de LG Blocks que alterna con el tema (texto oscuro en claro, blanco en oscuro). */
export function ThemedWordmark({ className }: { className?: string }) {
  const img = "h-full w-auto max-w-none object-contain";
  return (
    <span className={cn("block h-12", className)}>
      {/* Tema claro → fondo claro → logo de texto oscuro */}
      <img
        src={BRAND_ASSETS.logoFondoClaro}
        alt={APP_NAME}
        width={750}
        height={210}
        loading="lazy"
        decoding="async"
        className={cn(img, "dark:hidden")}
      />
      {/* Tema oscuro → fondo oscuro → logo de texto blanco */}
      <img
        src={BRAND_ASSETS.logoFondoOscuro}
        alt={APP_NAME}
        width={750}
        height={210}
        loading="lazy"
        decoding="async"
        className={cn(img, "hidden dark:block")}
      />
    </span>
  );
}

/** Icono de la marca (el cubo). Funciona sobre fondo claro y oscuro. */
export function BrandIcon({ className, alt = "" }: { className?: string; alt?: string }) {
  return (
    <img
      src={BRAND_ASSETS.logoIcono}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      className={cn("size-12 object-contain", className)}
    />
  );
}

// --- Logo de la barra lateral -----------------------------------------------------

/** Columna izquierda de la barra = ancho recogido (token --lateral-ancho-mini, 72 px). */
const COLUMNA = 72;
/** Alto de la fila del logo y tamaño de la imagen del cubo. */
const FILA = 64;
const CUBO = 40;

type WordmarkGeometry = (typeof LOGO_GEOMETRY)["fondoClaro" | "fondoOscuro"];

/**
 * Calcula dónde colocar el logo completo para que SU cubo coincida en tamaño y
 * altura con el cubo fijo de la columna, y recortarlo para mostrar solo el
 * texto, con la misma separación que en el original.
 */
function wordmarkLayout(g: WordmarkGeometry) {
  const icono = LOGO_GEOMETRY.icono;
  const altoCubo = CUBO * (icono.cubeY1 - icono.cubeY0); // alto visible del cubo fijo
  const arribaCubo = (FILA - CUBO) / 2 + CUBO * icono.cubeY0;
  const derechaCubo = (COLUMNA - CUBO) / 2 + CUBO * icono.cubeX1;

  const alto = altoCubo / (g.cubeY1 - g.cubeY0); // mismo alto de cubo que el fijo
  const ancho = alto / g.ratio;
  const separacion = (g.textX0 - g.cubeX1) * ancho; // hueco cubo–texto del original
  const recorte = derechaCubo + separacion / 2; // el recorte empieza en medio del hueco
  const izquierdaImagen = derechaCubo + separacion - g.textX0 * ancho;

  return {
    recorte,
    imagen: { left: izquierdaImagen - recorte, top: arribaCubo - alto * g.cubeY0, width: ancho, height: alto },
  };
}

const LAYOUT_CLARO = wordmarkLayout(LOGO_GEOMETRY.fondoClaro);
const LAYOUT_OSCURO = wordmarkLayout(LOGO_GEOMETRY.fondoOscuro);

/**
 * Logo de la barra lateral. El cubo está SIEMPRE en la columna izquierda y no
 * se mueve al abrir o recoger; al abrir, el texto del logo (según el tema)
 * aparece con fundido a su derecha, recortado del logo completo.
 */
export function SidebarLogo() {
  const texto = "absolute max-w-none";
  return (
    <div className="relative w-full" style={{ height: FILA }}>
      <span className="absolute top-0 left-0 flex items-center justify-center" style={{ width: COLUMNA, height: FILA }}>
        <BrandIcon alt={APP_NAME} className="size-10" />
      </span>
      {[
        { layout: LAYOUT_CLARO, src: BRAND_ASSETS.logoFondoClaro, tema: "dark:hidden" },
        { layout: LAYOUT_OSCURO, src: BRAND_ASSETS.logoFondoOscuro, tema: "hidden dark:block" },
      ].map(({ layout, src, tema }) => (
        <span
          key={src}
          aria-hidden
          className={cn(
            "absolute inset-y-0 right-0 overflow-hidden opacity-0 transition-opacity duration-(--lateral-duracion) ease-in-out motion-reduce:transition-none sidebar-expanded:opacity-100",
            tema,
          )}
          style={{ left: layout.recorte }}
        >
          <img src={src} alt="" loading="lazy" decoding="async" className={texto} style={layout.imagen} />
        </span>
      ))}
    </div>
  );
}
