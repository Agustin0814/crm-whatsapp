import { SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLES = ["¿Cómo activo el asistente de respuestas?", "¿Cuántos mensajes recibí este mes?", "Resúmeme este chat"];

/** Qué se le puede preguntar (estado vacío del chat). */
export function AssistantEmptyHint({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("space-y-3 text-sm text-texto-suave", compact ? "py-2" : "py-8 text-center")}>
      <SparklesIcon className={cn("size-6 text-marca-texto", !compact && "mx-auto")} aria-hidden />
      <p>Pregúntame cómo usar el CRM o pídeme datos. También puedo pedir tareas a los otros asistentes (con tu confirmación).</p>
      <ul className={cn("space-y-1 text-xs", !compact && "mx-auto max-w-xs")}>
        {EXAMPLES.map((e) => (
          <li key={e}>«{e}»</li>
        ))}
      </ul>
    </div>
  );
}
