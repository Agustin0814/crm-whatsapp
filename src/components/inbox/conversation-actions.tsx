"use client";

import { CircleDotIcon, MailIcon, PinIcon, PinOffIcon, TagIcon } from "lucide-react";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { StatusDot } from "@/components/crm/status-badge";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CONVERSATION_STATUSES,
  STATUS_LABELS,
  type Conversation,
  type ConversationItem,
  type ConversationStatus,
} from "@/lib/crm/types";

export const UNASSIGNED = "__sin_asignar__";

export type ConversationActionsHandlers = {
  onUpdate: (patch: Partial<Pick<Conversation, "status" | "assigned_to" | "is_pinned">>) => void;
  onMarkUnread: () => void;
  onToggleTag?: (tagId: string, on: boolean) => void;
};

type Props = ConversationActionsHandlers & {
  conversation: ConversationItem;
  /** Botón disparador; por defecto, un icono de "más". */
  triggerClassName?: string;
  align?: "start" | "end";
};

/** Menú de acciones de una conversación (lista y encabezado del chat). */
export function ConversationActionsMenu({
  conversation,
  onUpdate,
  onMarkUnread,
  onToggleTag,
  triggerClassName,
  align = "end",
}: Props) {
  const { activeProfiles: profiles, tags } = useCrm();
  const tagIds = new Set(conversation.contact?.tags.map((t) => t.id));

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={triggerClassName} aria-label="Más acciones">
              <Icon name="mas" className="size-5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Más acciones</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuItem onSelect={() => onUpdate({ is_pinned: !conversation.is_pinned })}>
          {conversation.is_pinned ? <PinOffIcon /> : <PinIcon />}
          {conversation.is_pinned ? "Desfijar" : "Fijar arriba"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onMarkUnread} disabled={conversation.unread_count > 0}>
          <MailIcon /> Marcar como no leída
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CircleDotIcon /> Estado
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={conversation.status}
              onValueChange={(v) => onUpdate({ status: v as ConversationStatus })}
            >
              {CONVERSATION_STATUSES.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  <StatusDot status={s} /> {STATUS_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icon name="asignar" /> Asignar a
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={conversation.assigned_to ?? UNASSIGNED}
              onValueChange={(v) => onUpdate({ assigned_to: v === UNASSIGNED ? null : v })}
            >
              <DropdownMenuRadioItem value={UNASSIGNED}>Sin asignar</DropdownMenuRadioItem>
              {profiles.map((p) => (
                <DropdownMenuRadioItem key={p.id} value={p.id}>
                  {profileName(p)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {onToggleTag && conversation.contact && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <TagIcon /> Etiquetas
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              {tags.length === 0 && (
                <DropdownMenuItem disabled>Crea etiquetas en «Etiquetas»</DropdownMenuItem>
              )}
              {tags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={tagIds.has(tag.id)}
                  onCheckedChange={(checked) => onToggleTag(tag.id, checked === true)}
                  // Mantener el menú abierto para marcar varias.
                  onSelect={(e) => e.preventDefault()}
                >
                  <TagChip tag={tag} size="xs" />
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
