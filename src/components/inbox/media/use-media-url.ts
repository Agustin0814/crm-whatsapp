"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaResponse } from "@/app/api/media/[messageId]/route";

/** Margen antes de que caduque una URL firmada para pedir otra. */
const EXPIRY_MARGIN_MS = 60_000;
/** Mientras el servidor diga «pending», se vuelve a preguntar cada… */
const PENDING_RETRY_MS = 8_000;
const MAX_PENDING_RETRIES = 6;

type CachedUrl = { url: string; expiresAt: number };

/**
 * Caché en memoria de URLs firmadas (por pestaña, nunca en la base ni en
 * localStorage). Evita pedir otra URL al volver a montar un mensaje.
 */
const urlCache = new Map<string, CachedUrl>();

function freshFromCache(messageId: string): CachedUrl | null {
  const cached = urlCache.get(messageId);
  if (!cached) return null;
  if (cached.expiresAt - Date.now() < EXPIRY_MARGIN_MS) {
    urlCache.delete(messageId);
    return null;
  }
  return cached;
}

export async function fetchMediaUrl(messageId: string, download = false): Promise<MediaResponse> {
  const res = await fetch(`/api/media/${messageId}${download ? "?download=1" : ""}`, { cache: "no-store" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { status: "failed", error: data.error ?? "No se pudo cargar el archivo." };
  }
  return (await res.json()) as MediaResponse;
}

export type MediaUrlState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "pending" }
  | { status: "failed"; error: string };

/**
 * URL firmada de un archivo, pedida de forma perezosa: solo cuando el
 * elemento que devuelve `ref` entra en pantalla. Se vuelve a pedir si cambia
 * media_status (Realtime), si caducó o al pulsar «Reintentar».
 */
export function useMediaUrl(messageId: string, mediaStatus: string | null) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MediaUrlState>(() => {
    const cached = freshFromCache(messageId);
    return cached ? { status: "ready", url: cached.url } : { status: "loading" };
  });
  const pendingTries = useRef(0);

  // Visibilidad: una vez visto, se queda «visto».
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !mediaStatus) return;
    // Primera carga con una URL todavía válida en caché: no hace falta pedir nada.
    if (attempt === 0 && freshFromCache(messageId)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    fetchMediaUrl(messageId)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "ready") {
          urlCache.set(messageId, { url: res.url, expiresAt: res.expiresAt });
          setState({ status: "ready", url: res.url });
        } else if (res.status === "pending") {
          setState({ status: "pending" });
          // El webhook aún lo descarga: se pregunta de nuevo (y Realtime avisará).
          if (pendingTries.current++ < MAX_PENDING_RETRIES) {
            timer = setTimeout(() => setAttempt((a) => a + 1), PENDING_RETRY_MS);
          }
        } else {
          setState({ status: "failed", error: res.error });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "failed", error: "Error de red al cargar el archivo." });
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, messageId, mediaStatus, attempt]);

  /** «Reintentar» o URL caducada (p. ej. error al cargar la imagen). */
  const retry = useCallback(() => {
    urlCache.delete(messageId);
    pendingTries.current = 0;
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  }, [messageId]);

  return { ref, state, retry };
}
