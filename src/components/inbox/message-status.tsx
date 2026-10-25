import { CircleAlertIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Message } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

/**
 * Estado de un mensaje saliente (va dentro de la burbuja naranja):
 *  enviando = reloj · enviado = una palomita · entregado = dos palomitas tenues
 *  leído = dos palomitas resaltadas · fallido = icono de error con el motivo en tooltip.
 */
export function MessageStatus({ message }: { message: Message }) {
  switch (message.status) {
    case "sending":
      return <StatusIcon label="Enviando" icon={<Icon name="reloj" className="size-3.5" />} />;
    case "sent":
      return <StatusIcon label="Enviado" icon={<Icon name="enviado" className="size-3.5" />} />;
    case "delivered":
      return <StatusIcon label="Entregado" icon={<Icon name="leido" className="size-3.5 opacity-70" />} />;
    case "read":
      return <StatusIcon label="Leído" icon={<Icon name="leido" strokeWidth={2.75} className="size-4" />} />;
    case "failed":
      return (
        <StatusIcon
          label={message.error ? `No se envió: ${message.error}` : "No se pudo enviar"}
          icon={
            // Círculo blanco detrás para que el rojo contraste sobre el naranja.
            <span className="flex size-4 items-center justify-center rounded-full bg-white">
              <CircleAlertIcon className="size-3.5 text-error-texto" aria-hidden />
            </span>
          }
        />
      );
    default:
      return null;
  }
}

function StatusIcon({ label, icon, className }: { label: string; icon: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex", className)} role="img" aria-label={label} tabIndex={0}>
          {icon}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
