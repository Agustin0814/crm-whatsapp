import type { ReactNode } from "react";

/**
 * Entrada suave de cada sección (fundido + 8 px hacia arriba, 200 ms; ver
 * .entrada-seccion en globals.css).
 *
 * Next vuelve a montar un template SOLO cuando cambia el segmento de ruta
 * (Bandeja → Contactos…). No se vuelve a montar con cambios de parámetros de
 * búsqueda (?c=, ?tab=), ni al elegir otra conversación (la Bandeja usa
 * history.replaceState), ni con eventos de Realtime: la Bandeja no parpadea ni
 * pierde estado. La barra lateral vive en el layout y no se vuelve a cargar.
 *
 * La animación no retrasa los datos: el contenido se monta de inmediato y solo
 * su opacidad/posición se animan; al terminar no queda ningún transform.
 */
export default function SectionTemplate({ children }: { children: ReactNode }) {
  return <div className="entrada-seccion flex min-h-0 flex-1 flex-col">{children}</div>;
}
