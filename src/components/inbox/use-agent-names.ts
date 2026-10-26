"use client";

import { useEffect, useState } from "react";
import { DEFAULT_DISPLAY_NAME, parseAgentConfig } from "@/lib/agents/config";
import { createClient } from "@/lib/supabase/client";

/** Nombre que el cliente eligió para cada agente (agents.config.display_name), por id. */
let cache: Promise<Map<string, string>> | null = null;

function loadNames(): Promise<Map<string, string>> {
  cache ??= Promise.resolve(createClient().from("agents").select("id, config"))
    .then(({ data, error }) => {
      if (error) throw error;
      return new Map((data ?? []).map((a) => [a.id, parseAgentConfig(a.config).display_name]));
    })
    .catch(() => {
      cache = null; // se reintenta en el siguiente montaje
      return new Map<string, string>();
    });
  return cache;
}

/**
 * Nombres de los agentes para la etiqueta de sus mensajes en el chat.
 * Se cargan una vez por sesión de la página; sin datos usa «Asistente».
 */
export function useAgentNames(): (agentId: string | null) => string {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    loadNames().then((map) => {
      if (!cancelled) setNames(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (agentId) => (agentId && names.get(agentId)) || DEFAULT_DISPLAY_NAME;
}

/** Tras guardar el nombre en /agentes, la próxima carga del chat lo vuelve a pedir. */
export function invalidateAgentNames(): void {
  cache = null;
}
