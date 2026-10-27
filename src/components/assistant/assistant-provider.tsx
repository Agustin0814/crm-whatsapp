"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, Suspense, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCrm } from "@/components/crm/crm-provider";
import { AGENT_KEYS } from "@/lib/agents/config";
import { canUseSystemAssistant, parseSystemConfig } from "@/lib/agents/system-config";
import {
  askAssistant,
  fetchAgentRequests,
  saveTempChat,
  type AgentRequest,
  type AskChat,
  type AskResponse,
  type ClientTurn,
} from "@/lib/agents/system-client";
import { createClient } from "@/lib/supabase/client";

// Estado del Asistente del sistema compartido por la burbuja y la sección
// /asistente. El CHAT TEMPORAL vive SOLO en esta memoria (sin localStorage ni
// base): sobrevive a la navegación dentro de la app porque el proveedor está en
// el layout, y se pierde al cerrar la burbuja, recargar o cerrar sesión.

const CHANGED_EVENT = "asistente:cambio";

/** Avisa que cambió la configuración del asistente (p. ej. desde /agentes). */
export function notifyAssistantChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED_EVENT));
}

export type AssistantAvailability = {
  loading: boolean;
  available: boolean;
  displayName: string;
  tempChat: boolean;
  savedChats: boolean;
};

type AssistantContextValue = {
  availability: AssistantAvailability;
  /** Conversación abierta en pantalla (Bandeja `?c=`); el servidor valida el acceso. */
  screenConversationId: string | null;
  temp: { turns: ClientTurn[]; pending: string | null };
  ask: (question: string, chat: AskChat) => Promise<AskResponse>;
  askTemp: (question: string) => Promise<void>;
  resetTemp: () => void;
  saveTemp: (title: string) => Promise<string>;
  requests: Record<string, AgentRequest>;
  upsertRequests: (rows: AgentRequest[]) => void;
  ensureRequests: (ids: string[]) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

const UNAVAILABLE: AssistantAvailability = { loading: true, available: false, displayName: "Asistente", tempChat: false, savedChats: false };

export function AssistantProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const { me } = useCrm();
  const [agentState, setAgentState] = useState<{ row: { enabled: boolean; config: unknown } | null; stopped: boolean; loaded: boolean }>({
    row: null,
    stopped: false,
    loaded: false,
  });
  const [version, setVersion] = useState(0);
  const [screenConversationId, setScreenConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ClientTurn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [requests, setRequests] = useState<Record<string, AgentRequest>>({});
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const requested = useRef(new Set<string>());

  // --- Disponibilidad: agente encendido, sin parada del proveedor y rol permitido ---
  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("agents").select("enabled, config").eq("key", AGENT_KEYS.system).maybeSingle(),
      supabase.rpc("agent_limits", { p_key: AGENT_KEYS.system }),
    ])
      .then(([agent, limits]) => {
        if (cancelled) return;
        const stopped = Boolean((limits.data as { kill_switch?: boolean } | null)?.kill_switch);
        setAgentState({ row: agent.data ?? null, stopped, loaded: true });
      })
      .catch(() => {
        if (!cancelled) setAgentState({ row: null, stopped: false, loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, version]);

  const availability = useMemo<AssistantAvailability>(() => {
    if (!agentState.loaded || !me) return UNAVAILABLE;
    const config = parseSystemConfig(agentState.row?.config);
    const available = Boolean(agentState.row?.enabled) && !agentState.stopped && canUseSystemAssistant(config, me.role);
    return { loading: false, available, displayName: config.display_name, tempChat: available && config.temp_chat, savedChats: available && config.saved_chats };
  }, [agentState, me]);

  // --- Solicitudes a otros agentes: en vivo por Realtime (RLS: solo las propias o admin) ---
  const upsertRequests = useCallback((rows: AgentRequest[]) => {
    if (!rows.length) return;
    setRequests((prev) => {
      const next = { ...prev };
      for (const r of rows) next[r.id] = r;
      return next;
    });
  }, []);

  const ensureRequests = useCallback(
    (ids: string[]) => {
      const missing = ids.filter((id) => !requested.current.has(id));
      if (!missing.length) return;
      for (const id of missing) requested.current.add(id);
      fetchAgentRequests(supabase, missing)
        .then(upsertRequests)
        .catch(() => undefined);
    },
    [supabase, upsertRequests],
  );

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`agent-requests-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_requests", filter: `requested_by=eq.${me.id}` }, (payload) => {
        if (payload.new && "id" in payload.new) upsertRequests([payload.new as AgentRequest]);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, me, upsertRequests]);

  // --- Preguntas ---
  const ask = useCallback(
    async (question: string, chat: AskChat) => {
      const response = await askAssistant({ question, chat, screenConversationId });
      upsertRequests(response.requests);
      return response;
    },
    [screenConversationId, upsertRequests],
  );

  const turnsRef = useRef(turns);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const askTemp = useCallback(
    async (question: string) => {
      setPending(question);
      try {
        const history = turnsRef.current.map((t) => t.token).filter((t): t is string => !!t);
        const response = await ask(question, { mode: "temp", history });
        setTurns((prev) => [...prev, { ...response.turn, token: response.token }]);
      } finally {
        setPending(null);
      }
    },
    [ask],
  );

  const resetTemp = useCallback(() => {
    setTurns([]);
    setPending(null);
  }, []);

  const saveTemp = useCallback(async (title: string) => {
    const tokens = turnsRef.current.map((t) => t.token).filter((t): t is string => !!t);
    const chatId = await saveTempChat(title, tokens);
    setTurns([]);
    return chatId;
  }, []);

  const value = useMemo<AssistantContextValue>(
    () => ({
      availability,
      screenConversationId,
      temp: { turns, pending },
      ask,
      askTemp,
      resetTemp,
      saveTemp,
      requests,
      upsertRequests,
      ensureRequests,
      open,
      setOpen,
      minimized,
      setMinimized,
    }),
    [availability, screenConversationId, turns, pending, ask, askTemp, resetTemp, saveTemp, requests, upsertRequests, ensureRequests, open, minimized],
  );

  return (
    <AssistantContext value={value}>
      {/* useSearchParams necesita Suspense (cacheComponents). */}
      <ScreenTracker onChange={setScreenConversationId} />
      {children}
    </AssistantContext>
  );
}

function ScreenTracker({ onChange }: { onChange: (id: string | null) => void }) {
  return (
    <Suspense fallback={null}>
      <ScreenTrackerInner onChange={onChange} />
    </Suspense>
  );
}

function ScreenTrackerInner({ onChange }: { onChange: (id: string | null) => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const id = pathname === "/" ? params.get("c") : null;
  useEffect(() => {
    onChange(id);
  }, [id, onChange]);
  return null;
}

export function useAssistant(): AssistantContextValue {
  const value = use(AssistantContext);
  if (!value) throw new Error("useAssistant debe usarse dentro de <AssistantProvider>");
  return value;
}
