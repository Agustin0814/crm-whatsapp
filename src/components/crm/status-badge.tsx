import { isConversationStatus, STATUS_LABELS, type ConversationStatus } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

/** Color del punto por estado (tokens de estado). */
export const STATUS_DOT: Record<ConversationStatus, string> = {
  open: "bg-exito",
  pending: "bg-advertencia",
  resolved: "bg-info",
  archived: "bg-texto-suave",
};

export function StatusDot({ status, className }: { status: string; className?: string }) {
  if (!isConversationStatus(status)) return null;
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_DOT[status], className)} aria-hidden />;
}

export function StatusLabel({ status }: { status: string }) {
  if (!isConversationStatus(status)) return <span>{status}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot status={status} />
      {STATUS_LABELS[status]}
    </span>
  );
}
