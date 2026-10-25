"use client";

import {
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  MicIcon,
  PinIcon,
  SearchXIcon,
  StickerIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { useNotifications } from "@/components/crm/notifications-provider";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initialsOf } from "@/lib/crm/avatar";
import { countAdvancedFilters, DEFAULT_FILTERS, type InboxFilters, type QuickFilter } from "@/lib/crm/conversations";
import type { ConversationItem } from "@/lib/crm/types";
import { formatListTime, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConversationActionsMenu, type ConversationActionsHandlers } from "./conversation-actions";
import { ConversationFilters } from "./conversation-filters";

/** Icono de la vista previa según el tipo del último mensaje. */
const PREVIEW_ICONS: Record<string, LucideIcon> = {
  image: ImageIcon,
  audio: MicIcon,
  video: VideoIcon,
  document: FileTextIcon,
  sticker: StickerIcon,
};

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "No leídas" },
  { value: "mine", label: "Mías" },
  { value: "unassigned", label: "Sin asignar" },
];

type Props = {
  items: ConversationItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  selectedId: string | null;
  now: number | null;
  filters: InboxFilters;
  /** Texto del buscador (se aplica con retardo en filters.search). */
  searchInput: string;
  onSearchInput: (value: string) => void;
  onFiltersChange: (patch: Partial<InboxFilters>) => void;
  onSelect: (id: string) => void;
  actionsFor: (item: ConversationItem) => ConversationActionsHandlers;
  className?: string;
};

export function ConversationList({
  items,
  loading,
  error,
  onRetry,
  loadingMore,
  hasMore,
  onLoadMore,
  selectedId,
  now,
  filters,
  searchInput,
  onSearchInput,
  onFiltersChange,
  onSelect,
  actionsFor,
  className,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { unreadConversations } = useNotifications();
  const isFiltered = filters.search.trim() !== "" || filters.quick !== "all" || countAdvancedFilters(filters) > 0;

  // Scroll infinito: al ver el final de la lista se pide la siguiente página.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onLoadMore(), {
      rootMargin: "200px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, items.length]);

  return (
    <aside className={cn("flex min-h-0 flex-col border-r bg-background", className)} aria-label="Conversaciones">
      <div className="space-y-3 px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold tracking-tight">Bandeja</h1>

        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Icon
              name="buscar"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => onSearchInput(e.target.value)}
              placeholder="Buscar nombre, teléfono o mensaje…"
              className="h-10 w-full rounded-lg border border-borde-control bg-background pr-8 pl-9 text-sm placeholder:text-texto-suave focus-visible:border-marca [&::-webkit-search-cancel-button]:hidden"
              aria-label="Buscar conversaciones"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => onSearchInput("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-texto-suave hover:text-texto"
                aria-label="Borrar búsqueda"
              >
                <Icon name="cerrar" className="size-4" />
              </button>
            )}
          </div>
          <ConversationFilters filters={filters} onChange={onFiltersChange} />
        </div>

        {/* Filtros rápidos */}
        {/* Una sola fila: si no cabe, se desplaza en horizontal sin barra visible */}
        <div
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filtro rápido"
        >
          {QUICK_FILTERS.map((q) => {
            const active = filters.quick === q.value;
            const count = q.value === "unread" ? unreadConversations : 0;
            return (
              <button
                key={q.value}
                type="button"
                aria-pressed={active}
                onClick={() => onFiltersChange({ quick: q.value })}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-transparent bg-marca-fuerte text-white"
                    : "border-borde-control bg-background text-texto hover:bg-superficie-2",
                )}
              >
                {q.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.6875rem] font-semibold tabular-nums",
                      active ? "bg-white text-marca-texto" : "bg-marca-fuerte text-white",
                    )}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading && <ListSkeleton />}

        {!loading && error && (
          <EmptyState
            tone="error"
            icon={SearchXIcon}
            title="No se pudieron cargar las conversaciones"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={
              <Button variant="outline" size="sm" onClick={onRetry}>
                Reintentar
              </Button>
            }
          />
        )}

        {!loading && !error && items.length === 0 &&
          (isFiltered ? (
            <EmptyState
              icon={SearchXIcon}
              title="Ninguna conversación coincide"
              description="Prueba con otra búsqueda o quita algunos filtros."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onSearchInput("");
                    onFiltersChange({ ...DEFAULT_FILTERS });
                  }}
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="vacio-bandeja"
              title="Bandeja vacía"
              description="Aún no hay conversaciones. Cuando un cliente escriba a tu WhatsApp, aparecerá aquí."
            />
          ))}

        {!loading && !error && (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <ConversationRow
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                now={now}
                onSelect={() => onSelect(item.id)}
                handlers={actionsFor(item)}
              />
            ))}
          </ul>
        )}

        <div ref={sentinelRef} />
        {loadingMore && (
          <p className="flex items-center justify-center gap-2 py-3 text-xs text-texto-suave">
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> Cargando más…
          </p>
        )}
      </div>
    </aside>
  );
}

function ConversationRow({
  item,
  selected,
  now,
  onSelect,
  handlers,
}: {
  item: ConversationItem;
  selected: boolean;
  now: number | null;
  onSelect: () => void;
  handlers: ConversationActionsHandlers;
}) {
  const { profiles } = useCrm();
  const contact = item.contact;
  const name = contact?.name || (contact ? formatPhone(contact.wa_id ?? contact.phone) : "Contacto");
  const unread = item.unread_count;
  const assignee = item.assigned_to ? profiles.find((p) => p.id === item.assigned_to) : null;
  const visibleTags = contact?.tags.slice(0, 2) ?? [];
  const extraTags = (contact?.tags.length ?? 0) - visibleTags.length;
  const PreviewIcon = item.last_message_type ? PREVIEW_ICONS[item.last_message_type] : undefined;

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full gap-3 rounded-xl border-l-[3px] px-3 py-3 text-left transition-colors",
          selected ? "border-marca bg-marca-suave" : "border-transparent hover:bg-superficie-2",
        )}
      >
        <ContactAvatar seed={contact?.wa_id ?? item.id} name={contact?.name} company={contact?.company} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums transition-opacity group-hover:opacity-0",
                unread > 0 ? "font-semibold text-marca-texto" : "text-texto-suave",
              )}
            >
              {now !== null && formatListTime(item.last_message_at, now)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1 text-sm",
                unread > 0 ? "text-texto" : "text-texto-suave",
              )}
            >
              {PreviewIcon && <PreviewIcon className="size-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{item.last_message_preview ?? "Sin mensajes"}</span>
            </span>
            {item.is_pinned && <PinIcon className="size-3.5 shrink-0 text-texto-suave" aria-label="Fijada" />}
            {unread > 0 && (
              <span
                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-marca-fuerte px-1.5 text-[0.6875rem] font-semibold text-white tabular-nums"
                aria-label={`${unread} sin leer`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
          {(visibleTags.length > 0 || assignee) && (
            <div className="flex items-center gap-1 pt-0.5">
              {visibleTags.map((tag) => (
                <TagChip key={tag.id} tag={tag} size="xs" />
              ))}
              {extraTags > 0 && <span className="text-[0.6875rem] text-texto-suave">+{extraTags}</span>}
              {assignee && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-superficie-3 text-[0.5625rem] font-semibold text-texto-suave">
                      {initialsOf(assignee.full_name)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Asignada a {assignee.full_name ?? "agente"}</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </button>
      <ConversationActionsMenu
        conversation={item}
        {...handlers}
        triggerClassName="absolute top-2 right-2 size-7 bg-background/90 opacity-0 backdrop-blur group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
      />
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-label="Cargando conversaciones" className="space-y-1">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex gap-3 px-3 py-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
