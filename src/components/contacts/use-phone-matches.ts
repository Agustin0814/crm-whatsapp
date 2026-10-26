"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findPhoneMatches, isSearchablePhone, type PhoneMatch, type PhoneOwner } from "@/lib/crm/phones";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 400;

/**
 * Coincidencias de un teléfono mientras se escribe (con retardo) y al salir del
 * campo (`checkNow`). Es solo aviso inmediato: el guardado vuelve a comprobar
 * en la base.
 */
export function usePhoneMatches(phone: string, owner: PhoneOwner, enabled = true) {
  const supabase = createClient();
  const [result, setResult] = useState<{ phone: string; matches: PhoneMatch[] }>({ phone: "", matches: [] });
  const [checking, setChecking] = useState(false);
  const requestRef = useRef(0);
  const { kind, id } = owner;

  const run = useCallback(
    (value: string) => {
      const request = ++requestRef.current;
      if (!isSearchablePhone(value)) {
        setResult({ phone: value, matches: [] });
        setChecking(false);
        return;
      }
      setChecking(true);
      findPhoneMatches(supabase, value, { kind, id })
        .then((matches) => {
          if (request === requestRef.current) setResult({ phone: value, matches });
        })
        .catch(() => {
          // Silencioso: el servidor vuelve a verificar al guardar.
        })
        .finally(() => {
          if (request === requestRef.current) setChecking(false);
        });
    },
    [supabase, kind, id],
  );

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => run(phone), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [phone, enabled, run]);

  // Las coincidencias solo valen para el número con el que se buscaron.
  const matches = result.phone === phone ? result.matches : [];
  return { matches, checking, checkNow: () => run(phone) };
}
