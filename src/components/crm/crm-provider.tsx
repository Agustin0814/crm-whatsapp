"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Profile, Tag } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";

type CrmContextValue = {
  /** Perfil del usuario con sesión (null mientras carga). */
  me: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  /** Todos los usuarios (para asignar conversaciones). */
  profiles: Profile[];
  tags: Tag[];
  reloadProfiles: () => Promise<void>;
  reloadTags: () => Promise<void>;
};

const CrmContext = createContext<CrmContextValue | null>(null);

/**
 * Datos compartidos por todas las pantallas del CRM: usuario actual, perfiles
 * y etiquetas. Se cargan con la sesión del usuario (RLS).
 */
export function CrmProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadProfiles = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("full_name");
    if (error) toast.error("No se pudieron cargar los usuarios");
    else setProfiles(data);
  }, [supabase]);

  const reloadTags = useCallback(async () => {
    const { data, error } = await supabase.from("tags").select("*").order("name");
    if (error) toast.error("No se pudieron cargar las etiquetas");
    else setTags(data);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
      await Promise.all([reloadProfiles(), reloadTags()]);
      if (!cancelled) setLoading(false);
    })();

    // Si la sesión se cierra (en esta u otra pestaña) se vuelve al login.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
        router.refresh();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, router, reloadProfiles, reloadTags]);

  const value = useMemo<CrmContextValue>(() => {
    const me = profiles.find((p) => p.id === userId) ?? null;
    return {
      me,
      isAdmin: me?.role === "admin",
      loading,
      profiles,
      tags,
      reloadProfiles,
      reloadTags,
    };
  }, [profiles, userId, loading, tags, reloadProfiles, reloadTags]);

  return <CrmContext value={value}>{children}</CrmContext>;
}

export function useCrm(): CrmContextValue {
  const value = use(CrmContext);
  if (!value) throw new Error("useCrm debe usarse dentro de <CrmProvider>");
  return value;
}

/** Nombre a mostrar de un usuario. */
export function profileName(profile: Pick<Profile, "full_name"> | null | undefined): string {
  return profile?.full_name?.trim() || "Sin nombre";
}
