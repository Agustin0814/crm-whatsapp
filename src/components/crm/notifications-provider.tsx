"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  type ReactNode,
} from "react";
import { APP_NAME, BRAND_ASSETS } from "@/lib/brand";
import type { Message } from "@/lib/crm/types";
import { createNotificationSound, type NotificationSound } from "@/lib/notification-sound";
import { createClient } from "@/lib/supabase/client";

/** Evento para pedir a la bandeja (si está montada) que abra una conversación. */
export const OPEN_CONVERSATION_EVENT = "crm:open-conversation";
const SOUND_KEY = "crm:notif-sound";
const DESKTOP_KEY = "crm:notif-desktop";

type Permission = NotificationPermission | "unsupported";

/**
 * Estado REAL del canal de Supabase Realtime (callback de subscribe):
 *  - connecting: aún no se ha unido por primera vez;
 *  - online: SUBSCRIBED;
 *  - reconnecting: error, tiempo agotado, canal cerrado o navegador sin red.
 */
export type RealtimeStatus = "connecting" | "online" | "reconnecting";

type NotificationsContextValue = {
  /** Mensajes sin leer en conversaciones no archivadas (título de la pestaña). */
  unreadTotal: number;
  /** Conversaciones con mensajes sin leer, no archivadas (badges). */
  unreadConversations: number;
  realtimeStatus: RealtimeStatus;
  soundEnabled: boolean;
  setSoundEnabled: (value: boolean) => void;
  /** El usuario activó las notificaciones del navegador en este equipo. */
  desktopEnabled: boolean;
  permission: Permission;
  /** Pide permiso al navegador (debe llamarse desde un clic). */
  enableDesktop: () => Promise<void>;
  disableDesktop: () => void;
  /** Conversación abierta en la bandeja (no se notifica si está a la vista). */
  setActiveConversationId: (id: string | null) => void;
  playTestSound: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// localStorage puede fallar (modo privado, bloqueado): siempre con try/catch.
function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}
function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Sin almacenamiento: la preferencia dura solo esta sesión.
  }
}

/**
 * Notificaciones de mensajes entrantes: sonido, contador en el título de la
 * pestaña y notificaciones del navegador cuando la pestaña no está activa.
 * Nunca notifica mensajes salientes (propios) ni de conversaciones archivadas.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();

  const [unread, setUnread] = useState({ total: 0, conversations: 0 });
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [soundEnabled, setSoundState] = useState(true);
  const [desktopEnabled, setDesktopState] = useState(false);
  const [permission, setPermission] = useState<Permission>("default");

  const soundRef = useRef<NotificationSound | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const prefsRef = useRef({ sound: true, desktop: false });

  // Preferencias guardadas en este navegador y sonido (se desbloquea al primer clic/tecla).
  useEffect(() => {
    const sound = readFlag(SOUND_KEY, true);
    const desktop = readFlag(DESKTOP_KEY, false);
    const perm: Permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
    prefsRef.current = { sound, desktop };
    soundRef.current = createNotificationSound();
    // Diferido para no hacer setState síncrono dentro del efecto.
    const t = setTimeout(() => {
      setSoundState(sound);
      setDesktopState(desktop);
      setPermission(perm);
    }, 0);
    return () => {
      clearTimeout(t);
      soundRef.current?.dispose();
      soundRef.current = null;
    };
  }, []);

  const fetchUnread = useCallback(async () => {
    const { data } = await supabase
      .from("conversations")
      .select("unread_count")
      .gt("unread_count", 0)
      .neq("status", "archived");
    const rows = data ?? [];
    return { total: rows.reduce((sum, c) => sum + c.unread_count, 0), conversations: rows.length };
  }, [supabase]);

  const notify = useCallback(
    async (message: Message) => {
      // Solo entrantes (el filtro del canal ya lo garantiza; doble seguridad).
      if (message.direction !== "inbound") return;
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, status, contacts(name, wa_id)")
        .eq("id", message.conversation_id)
        .maybeSingle();
      if (!conv || conv.status === "archived") return;

      const visible = document.visibilityState === "visible";
      if (visible && activeIdRef.current === conv.id) return; // ya está a la vista

      if (prefsRef.current.sound) soundRef.current?.play();

      if (
        !visible &&
        prefsRef.current.desktop &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const title = conv.contacts?.name || (conv.contacts?.wa_id ? `+${conv.contacts.wa_id}` : "Contacto");
        const body = message.body ?? `[${message.type}]`;
        const n = new Notification(title, { body: body.slice(0, 140), tag: conv.id, icon: BRAND_ASSETS.icon192 });
        n.onclick = () => {
          window.focus();
          // En la bandeja se abre directamente; desde otra página se navega.
          if (window.location.pathname === "/") {
            window.dispatchEvent(new CustomEvent(OPEN_CONVERSATION_EVENT, { detail: conv.id }));
          } else {
            router.push(`/?c=${conv.id}`);
          }
          n.close();
        };
      }
    },
    [supabase, router],
  );

  // Realtime: mensajes entrantes, contadores y estado de la conexión.
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const reload = () =>
      fetchUnread().then((value) => {
        if (!cancelled) setUnread(value);
      });
    const scheduleReload = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void reload(), 400);
    };
    const onOffline = () => setRealtimeStatus("reconnecting");

    void reload();
    window.addEventListener("offline", onOffline);
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel("notifications")
        .on<Message>(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: "direction=eq.inbound" },
          (payload) => void notify(payload.new),
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, scheduleReload)
        .subscribe((status) => {
          if (cancelled) return; // el CLOSED de la limpieza no cuenta
          if (status === "SUBSCRIBED") {
            setRealtimeStatus("online");
            void reload(); // al reconectar, recuperar lo que llegó mientras tanto
          } else {
            setRealtimeStatus("reconnecting"); // CHANNEL_ERROR, TIMED_OUT o CLOSED
          }
        });
    })();

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      window.removeEventListener("offline", onOffline);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, fetchUnread, notify]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      unreadTotal: unread.total,
      unreadConversations: unread.conversations,
      realtimeStatus,
      soundEnabled,
      setSoundEnabled: (v) => {
        prefsRef.current.sound = v;
        writeFlag(SOUND_KEY, v);
        setSoundState(v);
      },
      desktopEnabled,
      permission,
      enableDesktop: async () => {
        if (typeof Notification === "undefined") return;
        const result = await Notification.requestPermission();
        setPermission(result);
        const enabled = result === "granted";
        prefsRef.current.desktop = enabled;
        writeFlag(DESKTOP_KEY, enabled);
        setDesktopState(enabled);
      },
      disableDesktop: () => {
        prefsRef.current.desktop = false;
        writeFlag(DESKTOP_KEY, false);
        setDesktopState(false);
      },
      setActiveConversationId: (id) => {
        activeIdRef.current = id;
      },
      // Botón «Probar»: es un clic, así que además desbloquea el audio.
      playTestSound: () => soundRef.current?.play(),
    }),
    [unread, realtimeStatus, soundEnabled, desktopEnabled, permission],
  );

  return (
    <NotificationsContext value={value}>
      {children}
      {/* usePathname es dato de petición en rutas con [id]: va en su propio Suspense */}
      <Suspense fallback={null}>
        <TitleCounter total={unread.total} />
      </Suspense>
    </NotificationsContext>
  );
}

/**
 * Contador en el título: "(3) Contactos · LG Blocks CRM". Se reaplica al
 * navegar porque Next cambia el título de cada página.
 */
function TitleCounter({ total }: { total: number }) {
  const pathname = usePathname();
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "") || APP_NAME;
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }, [total, pathname]);
  return null;
}

export function useNotifications(): NotificationsContextValue {
  const value = use(NotificationsContext);
  if (!value) throw new Error("useNotifications debe usarse dentro de <NotificationsProvider>");
  return value;
}
