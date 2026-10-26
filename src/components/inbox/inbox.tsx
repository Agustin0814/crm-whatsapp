"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ContactDetails } from "@/components/contacts/contact-details";
import { useShell } from "@/components/crm/app-nav";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { OPEN_CONVERSATION_EVENT, useNotifications } from "@/components/crm/notifications-provider";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { errorMessage, fetchContact, setContactTag } from "@/lib/crm/contacts";
import {
  compareConversations,
  DEFAULT_FILTERS,
  fetchConversationById,
  fetchConversationIfMatches,
  fetchConversationPage,
  PAGE_SIZE,
  type InboxFilters,
} from "@/lib/crm/conversations";
import {
  isConversationStatus,
  STATUS_LABELS,
  type ContactWithTags,
  type Conversation,
  type ConversationItem,
  type Message,
} from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ChatView } from "./chat-view";
import type { ConversationActionsHandlers } from "./conversation-actions";
import { ConversationList } from "./conversation-list";

/** Últimos N mensajes que se cargan al abrir una conversación. */
const MESSAGE_LIMIT = 200;
const SEARCH_DEBOUNCE_MS = 300;

type ConversationPatch = Partial<Pick<Conversation, "status" | "assigned_to" | "is_pinned" | "unread_count">>;

function upsertItem(list: ConversationItem[], item: ConversationItem): ConversationItem[] {
  return [...list.filter((c) => c.id !== item.id), item].sort(compareConversations);
}

function upsertMessage(list: Message[], message: Message): Message[] {
  const index = list.findIndex((m) => m.id === message.id);
  if (index === -1) return [...list, message].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const next = list.slice();
  next[index] = message;
  return next;
}

export function Inbox() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { me, profiles, tags, loading: crmLoading } = useCrm();
  const { setActiveConversationId } = useNotifications();
  // ≥ 1024 px: lista y chat lado a lado (lo resuelve el CSS). ≥ 1536 px: además la ficha como columna.
  const isXl = useMediaQuery("(min-width: 1536px)");
  const hasSidebar = useMediaQuery("(min-width: 768px)"); // < 768 px se usa la barra inferior
  const { setHideBottomNav } = useShell();
  const myId = me?.id ?? null;

  // --- Estado ----------------------------------------------------------------
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [listError, setListError] = useState(false);
  /** Se incrementa para volver a pedir la primera página («Reintentar»). */
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("c"));
  // Copia fresca de la conversación abierta (aunque no cumpla los filtros).
  const [current, setCurrent] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(() => searchParams.get("c") !== null);

  const [panelOpen, setPanelOpen] = useState(true); // columna derecha (≥ 1536 px)
  const [sheetOpen, setSheetOpen] = useState(false); // panel deslizante (< 1536 px)
  const [now, setNow] = useState<number | null>(null);

  // Refs para los callbacks de Realtime.
  const filtersRef = useRef(filters);
  const myIdRef = useRef(myId);
  const selectedIdRef = useRef(selectedId);
  const requestRef = useRef(0);
  useEffect(() => {
    filtersRef.current = filters;
    myIdRef.current = myId;
    selectedIdRef.current = selectedId;
  }, [filters, myId, selectedId]);

  const selected = current?.id === selectedId ? current : (items.find((c) => c.id === selectedId) ?? null);

  // En móvil y tablet, con un chat abierto se oculta la barra inferior (pantalla completa).
  useEffect(() => {
    setHideBottomNav(selectedId !== null && !hasSidebar);
    return () => setHideBottomNav(false);
  }, [selectedId, hasSidebar, setHideBottomNav]);

  // --- Reloj (ventana de 24 h y horas relativas) ------------------------------
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  // --- Búsqueda con retardo ----------------------------------------------------
  useEffect(() => {
    if (searchInput === filtersRef.current.search) return;
    const t = setTimeout(() => {
      setLoading(true);
      setFilters((f) => ({ ...f, search: searchInput }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const changeFilters = useCallback((patch: Partial<InboxFilters>) => {
    setLoading(true);
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  // --- Primera página de la lista (cada vez que cambian los filtros) ----------
  useEffect(() => {
    if (crmLoading) return;
    const request = ++requestRef.current;
    (async () => {
      try {
        const page = await fetchConversationPage(supabase, filters, myId, 0);
        if (request !== requestRef.current) return;
        setItems(page);
        setHasMore(page.length === PAGE_SIZE);
        setListError(false);
      } catch (error) {
        if (request === requestRef.current) {
          setListError(true);
          toast.error(errorMessage(error, "No se pudieron cargar las conversaciones"));
        }
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    })();
  }, [supabase, filters, myId, crmLoading, reloadKey]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const request = requestRef.current;
    setLoadingMore(true);
    try {
      const page = await fetchConversationPage(supabase, filters, myId, items.length);
      if (request !== requestRef.current) return;
      setItems((prev) => page.reduce(upsertItem, prev));
      setHasMore(page.length === PAGE_SIZE);
    } catch (error) {
      toast.error(errorMessage(error, "No se pudieron cargar más conversaciones"));
    } finally {
      setLoadingMore(false);
    }
  }, [supabase, filters, myId, items.length, loading, loadingMore, hasMore]);

  // --- Conversación abierta ----------------------------------------------------
  const markRead = useCallback(
    async (id: string) => {
      const patchItem = (c: ConversationItem) => (c.id === id ? { ...c, unread_count: 0 } : c);
      setItems((prev) => prev.map(patchItem));
      setCurrent((prev) => (prev ? patchItem(prev) : prev));
      // human_seen_at: el asistente en automático no responde si una persona ya vio el chat.
      const { error } = await supabase
        .from("conversations")
        .update({ unread_count: 0, human_seen_at: new Date().toISOString() })
        .eq("id", id);
      if (error) toast.error("No se pudo marcar como leída");
    },
    [supabase],
  );

  /** Guarda la copia fresca de la conversación abierta y la marca leída si está a la vista. */
  const applyCurrent = useCallback(
    (id: string, conv: ConversationItem | null) => {
      if (selectedIdRef.current !== id) return;
      setCurrent(conv);
      if (conv && conv.unread_count > 0 && document.visibilityState === "visible") void markRead(id);
    },
    [markRead],
  );

  const loadCurrent = useCallback(
    (id: string) =>
      fetchConversationById(supabase, id)
        .then((conv) => applyCurrent(id, conv))
        .catch(() => undefined), // se reintenta con el siguiente evento
    [supabase, applyCurrent],
  );

  useEffect(() => {
    setActiveConversationId(selectedId);
    window.history.replaceState(null, "", selectedId ? `/?c=${selectedId}` : "/");
    return () => setActiveConversationId(null);
  }, [selectedId, setActiveConversationId]);

  // Mensajes + datos frescos de la conversación al abrirla.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    // applyCurrent también la marca como leída.
    fetchConversationById(supabase, selectedId)
      .then((conv) => {
        if (!cancelled) applyCurrent(selectedId, conv);
      })
      .catch(() => toast.error("No se pudo abrir la conversación"));
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error("No se pudieron cargar los mensajes");
        setMessages((data ?? []).reverse());
        setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, supabase, applyCurrent]);

  // Al volver a la pestaña, marcar como leída la conversación abierta.
  const selectedRef = useRef<ConversationItem | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    const onVisible = () => {
      const conv = selectedRef.current;
      if (document.visibilityState === "visible" && conv && conv.unread_count > 0) void markRead(conv.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

  // --- Realtime ------------------------------------------------------------------
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    const pending = new Map<string, ReturnType<typeof setTimeout>>();

    // Reevalúa una conversación contra los filtros: entra, se actualiza o sale.
    const refresh = (id: string) => {
      clearTimeout(pending.get(id));
      pending.set(
        id,
        setTimeout(async () => {
          pending.delete(id);
          try {
            const match = await fetchConversationIfMatches(supabase, id, filtersRef.current, myIdRef.current);
            setItems((prev) => (match ? upsertItem(prev, match) : prev.filter((c) => c.id !== id)));
          } catch {
            // Silencioso: el próximo evento lo corrige.
          }
          if (id === selectedIdRef.current) void loadCurrent(id);
        }, 150),
      );
    };

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel("inbox")
        .on<Conversation>("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (payload) => {
          if (payload.eventType === "DELETE") {
            const id = payload.old.id;
            if (id) setItems((prev) => prev.filter((c) => c.id !== id));
            return;
          }
          refresh(payload.new.id);
        })
        .on<Message>("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          if (payload.new.conversation_id === selectedIdRef.current) {
            setMessages((prev) => upsertMessage(prev, payload.new));
          }
        })
        .on<Message>("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
          if (payload.new.conversation_id === selectedIdRef.current) {
            setMessages((prev) => upsertMessage(prev, payload.new));
          }
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      pending.forEach(clearTimeout);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, loadCurrent]);

  // --- Acciones ----------------------------------------------------------------
  function selectConversation(id: string | null) {
    if (id === selectedId) return;
    setMessages([]);
    setLoadingMessages(id !== null);
    setCurrent(null);
    setSheetOpen(false);
    setSelectedId(id);
  }

  // Clic en una notificación del navegador estando ya en la bandeja.
  const selectRef = useRef(selectConversation);
  useEffect(() => {
    selectRef.current = selectConversation;
  });
  useEffect(() => {
    const onOpen = (event: Event) => {
      const id = (event as CustomEvent<unknown>).detail;
      if (typeof id === "string") selectRef.current(id);
    };
    window.addEventListener(OPEN_CONVERSATION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONVERSATION_EVENT, onOpen);
  }, []);

  function patchLocal(id: string, patch: ConversationPatch) {
    const apply = (c: ConversationItem) => (c.id === id ? { ...c, ...patch } : c);
    setItems((prev) => prev.map(apply).sort(compareConversations));
    setCurrent((prev) => (prev ? apply(prev) : prev));
  }

  function patchContact(contactId: string, update: (c: ContactWithTags) => ContactWithTags) {
    const apply = (c: ConversationItem) =>
      c.contact?.id === contactId ? { ...c, contact: update(c.contact) } : c;
    setItems((prev) => prev.map(apply));
    setCurrent((prev) => (prev ? apply(prev) : prev));
  }

  async function updateConversation(item: ConversationItem, patch: ConversationPatch) {
    patchLocal(item.id, patch);
    const { error } = await supabase.from("conversations").update(patch).eq("id", item.id);
    if (error) {
      patchLocal(item.id, {
        status: item.status,
        assigned_to: item.assigned_to,
        is_pinned: item.is_pinned,
        unread_count: item.unread_count,
      });
      toast.error(errorMessage(error, "No se pudo actualizar la conversación"));
      return false;
    }
    return true;
  }

  const actionsFor = (item: ConversationItem): ConversationActionsHandlers => ({
    onUpdate: async (patch) => {
      const ok = await updateConversation(item, patch);
      if (!ok) return;
      if (patch.status && isConversationStatus(patch.status)) toast.success(`Estado: ${STATUS_LABELS[patch.status]}`);
      if (patch.assigned_to !== undefined) {
        const who = profiles.find((p) => p.id === patch.assigned_to);
        toast.success(patch.assigned_to ? `Asignada a ${profileName(who)}` : "Conversación sin asignar");
      }
      if (patch.is_pinned !== undefined) toast.success(patch.is_pinned ? "Conversación fijada" : "Conversación desfijada");
    },
    onMarkUnread: async () => {
      // Se cierra para que no vuelva a marcarse como leída al instante.
      if (item.id === selectedId) selectConversation(null);
      const ok = await updateConversation(item, { unread_count: 1 });
      if (ok) toast.success("Marcada como no leída");
    },
    onToggleTag: item.contact
      ? async (tagId, on) => {
          const contactId = item.contact!.id;
          const tag = tags.find((t) => t.id === tagId);
          if (!tag) return;
          patchContact(contactId, (c) => ({
            ...c,
            tags: on
              ? [...c.tags.filter((t) => t.id !== tagId), tag].sort((a, b) => a.name.localeCompare(b.name, "es"))
              : c.tags.filter((t) => t.id !== tagId),
          }));
          try {
            await setContactTag(supabase, contactId, tagId, on);
          } catch (error) {
            toast.error(errorMessage(error, "No se pudo actualizar la etiqueta"));
          }
        }
      : undefined,
  });

  function handleSent(message: Message) {
    if (message.conversation_id === selectedIdRef.current) setMessages((prev) => upsertMessage(prev, message));
  }

  function handleContactChange(contact: ContactWithTags) {
    patchContact(contact.id, () => contact);
  }

  function reloadContact(contactId: string) {
    fetchContact(supabase, contactId)
      .then(handleContactChange)
      .catch(() => toast.error("No se pudo recargar el contacto"));
  }

  function toggleDetails() {
    if (isXl) setPanelOpen((v) => !v);
    else setSheetOpen((v) => !v);
  }

  // --- Render --------------------------------------------------------------------
  const details = selected?.contact ? (
    <ContactDetails key={selected.contact.id} contact={selected.contact} onContactChange={handleContactChange} />
  ) : null;

  return (
    <div className="flex h-full min-h-0">
      <ConversationList
        className={cn("w-full lg:w-(--lista-ancho) lg:shrink-0", selectedId ? "hidden lg:flex" : "flex")}
        items={items}
        loading={loading}
        error={listError}
        onRetry={() => {
          setLoading(true);
          setReloadKey((k) => k + 1);
        }}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={() => void loadMore()}
        selectedId={selectedId}
        now={now}
        filters={filters}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        onFiltersChange={changeFilters}
        onSelect={selectConversation}
        actionsFor={actionsFor}
      />

      <section className={cn("min-w-0 flex-1 flex-col", selectedId ? "flex" : "hidden lg:flex")}>
        {selected ? (
          <ChatView
            key={selected.id}
            conversation={selected}
            messages={messages}
            loadingMessages={loadingMessages}
            now={now}
            detailsOpen={isXl ? panelOpen : sheetOpen}
            onToggleDetails={toggleDetails}
            onBack={() => selectConversation(null)}
            onSent={handleSent}
            onReloadContact={() => selected.contact && reloadContact(selected.contact.id)}
            {...actionsFor(selected)}
          />
        ) : selectedId ? (
          <div className="flex-1 bg-background" aria-label="Cargando conversación" />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-superficie-2/50">
            <EmptyState
              icon="bandeja"
              title="Selecciona una conversación"
              description="Elige un chat de la lista para leer los mensajes, responder y ver la ficha del contacto."
            />
          </div>
        )}
      </section>

      {/* Ficha del contacto: columna en pantallas anchas, panel deslizante en el resto */}
      {selected && isXl && panelOpen && (
        <aside className="flex w-(--ficha-ancho) shrink-0 flex-col border-l bg-background">
          <header className="flex h-16 items-center justify-between border-b px-5">
            <h2 className="text-lg font-semibold">Ficha del contacto</h2>
            <IconButton label="Cerrar ficha" onClick={() => setPanelOpen(false)}>
              <Icon name="cerrar" className="size-5" />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{details}</div>
        </aside>
      )}
      <Sheet open={!isXl && sheetOpen && selected !== null} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-(--ficha-ancho)">
          <SheetHeader className="h-16 justify-center border-b px-5">
            <SheetTitle className="text-lg">Ficha del contacto</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{details}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
