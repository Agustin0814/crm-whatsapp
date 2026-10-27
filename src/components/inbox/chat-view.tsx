"use client";

import { ArrowLeftIcon, PanelRightCloseIcon, PanelRightOpenIcon, PinIcon } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { StatusDot } from "@/components/crm/status-badge";
import { TagChip } from "@/components/crm/tag-chip";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isWindowOpen, windowRemainingMs } from "@/lib/conversation-window";
import {
  CONVERSATION_STATUSES,
  STATUS_LABELS,
  type ConversationItem,
  type ConversationStatus,
  type Message,
} from "@/lib/crm/types";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Composer, type ComposerHandle } from "./composer";
import { ConversationActionsMenu, UNASSIGNED, type ConversationActionsHandlers } from "./conversation-actions";
import { MessageList } from "./message-list";
import { NotesPanel } from "./notes-panel";
import { CompanyMatchBanner } from "./company-match-banner";
import { SuggestionBanner } from "./suggestion-banner";
import { AgentPauseToggle } from "./agent-pause-toggle";
import { AgentSuggestionBanner } from "./agent-suggestion-banner";

type Props = ConversationActionsHandlers & {
  conversation: ConversationItem;
  messages: Message[];
  loadingMessages: boolean;
  now: number | null;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onBack: () => void;
  onSent: (message: Message) => void;
  /** Recarga el contacto (p. ej. tras aceptar la sugerencia de prospecto). */
  onReloadContact: () => void;
};

/**
 * Chat: encabezado (contacto, etiquetas, estado, agente, acciones) y cuerpo
 * con los mensajes o las notas internas. No se muestra «en línea» ni
 * «escribiendo»: la API de WhatsApp Business no da esa información.
 */
export function ChatView({
  conversation,
  messages,
  loadingMessages,
  now,
  detailsOpen,
  onToggleDetails,
  onBack,
  onSent,
  onReloadContact,
  ...handlers
}: Props) {
  const { profiles } = useCrm();
  const [showNotes, setShowNotes] = useState(false);
  const composerRef = useRef<ComposerHandle>(null);
  // Contador de dragenter/dragleave: los hijos disparan eventos propios.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const contact = conversation.contact;
  const title = contact?.name || (contact ? formatPhone(contact.wa_id ?? contact.phone) : "Contacto");
  const windowOpen = now === null ? null : isWindowOpen(conversation.last_inbound_at, now);
  const remaining = now === null ? 0 : windowRemainingMs(conversation.last_inbound_at, now);
  const tags = contact?.tags ?? [];
  const canDrop = windowOpen === true;
  const lastInboundId = messages.findLast((m) => m.direction === "inbound")?.id ?? null;

  function hasFiles(event: DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }
  function onDragEnter(event: DragEvent) {
    if (!hasFiles(event) || !canDrop) return;
    event.preventDefault();
    dragDepth.current++;
    setDragging(true);
  }
  function onDragOver(event: DragEvent) {
    if (!hasFiles(event) || !canDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }
  function onDrop(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && canDrop) composerRef.current?.attachFile(file);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-16 items-center gap-2 border-b bg-background px-2 py-2 md:px-4">
        <IconButton label="Volver a la lista" className="lg:hidden" onClick={onBack}>
          <ArrowLeftIcon className="size-5" aria-hidden />
        </IconButton>

        <button
          type="button"
          onClick={onToggleDetails}
          className="flex min-w-0 items-center gap-3 rounded-xl p-1 pr-2 text-left hover:bg-superficie-2"
          aria-label={`Ver ficha de ${title}`}
        >
          <ContactAvatar seed={contact?.wa_id ?? conversation.id} name={contact?.name} company={contact?.company} size="md" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-lg leading-tight font-semibold">
              <span className="truncate">{title}</span>
              {conversation.is_pinned && <PinIcon className="size-3.5 shrink-0 text-texto-suave" aria-label="Fijada" />}
            </p>
            {tags.length > 0 ? (
              <div className="mt-1 flex gap-1 overflow-hidden">
                {tags.slice(0, 3).map((tag) => (
                  <TagChip key={tag.id} tag={tag} size="xs" />
                ))}
                {tags.length > 3 && <span className="text-xs text-texto-suave">+{tags.length - 3}</span>}
              </div>
            ) : (
              contact && <p className="truncate text-xs text-texto-suave">{formatPhone(contact.wa_id ?? contact.phone)}</p>
            )}
          </div>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Selectores visibles en pantallas anchas; en el resto están en el menú «más» */}
          <Select
            value={conversation.status}
            onValueChange={(v) => handlers.onUpdate({ status: v as ConversationStatus })}
          >
            <SelectTrigger className="hidden h-10 w-36 rounded-lg xl:flex" aria-label="Estado de la conversación">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {CONVERSATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <StatusDot status={s} /> {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={conversation.assigned_to ?? UNASSIGNED}
            onValueChange={(v) => handlers.onUpdate({ assigned_to: v === UNASSIGNED ? null : v })}
          >
            <SelectTrigger className="hidden h-10 w-44 rounded-lg xl:flex" aria-label="Agente asignado">
              <Icon name="asignar" className="size-4 text-texto-suave" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {profileName(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <AgentPauseToggle conversation={conversation} />

          <IconButton
            label={showNotes ? "Volver a los mensajes" : "Notas internas"}
            onClick={() => setShowNotes((v) => !v)}
            aria-pressed={showNotes}
            className={cn("text-texto-suave", showNotes && "bg-marca-suave text-marca-texto")}
          >
            <Icon name="notas" className="size-5" />
          </IconButton>

          <ConversationActionsMenu conversation={conversation} {...handlers} triggerClassName="text-texto-suave" />

          <IconButton
            label={detailsOpen ? "Cerrar ficha del contacto" : "Abrir ficha del contacto"}
            onClick={onToggleDetails}
            aria-pressed={detailsOpen}
            className="text-texto-suave"
          >
            {detailsOpen ? (
              <PanelRightCloseIcon className="size-5" aria-hidden />
            ) : (
              <PanelRightOpenIcon className="size-5" aria-hidden />
            )}
          </IconButton>
        </div>
      </header>

      {contact && (
        <SuggestionBanner
          contactId={contact.id}
          classification={contact.classification}
          refreshKey={lastInboundId}
          onResolved={onReloadContact}
        />
      )}
      {contact && (
        <CompanyMatchBanner contactId={contact.id} phoneKey={`${contact.wa_id ?? ""}|${contact.phone ?? ""}`} />
      )}

      {/* Se mantienen montados ambos para conservar el borrador y el scroll */}
      <div
        className={cn("relative min-h-0 flex-1 flex-col", showNotes ? "hidden" : "flex")}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-marca bg-marca-suave/90 text-marca-texto">
            <p className="flex items-center gap-2 text-base font-semibold">
              <Icon name="adjuntar" className="size-5" /> Suelta el archivo para adjuntarlo
            </p>
          </div>
        )}
        <MessageList messages={messages} contact={contact} loading={loadingMessages} now={now} />
        <AgentSuggestionBanner conversationId={conversation.id} windowOpen={windowOpen} />
        <Composer
          ref={composerRef}
          conversationId={conversation.id}
          contact={contact}
          windowOpen={windowOpen}
          remainingMs={remaining}
          hasInbound={conversation.last_inbound_at !== null}
          onSent={onSent}
        />
      </div>
      <div className={cn("min-h-0 flex-1 flex-col", showNotes ? "flex" : "hidden")}>
        <NotesPanel conversationId={conversation.id} contactId={conversation.contact_id} />
      </div>

    </div>
  );
}
