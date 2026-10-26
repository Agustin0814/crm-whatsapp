"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/crm/contacts";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { SectionHeader } from "./section-header";

function toKeywords(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Reglas de contactos y ventas: días sin compra para marcar a un cliente
 * como «Inactivo» y palabras que sugieren un posible prospecto. Las lee la
 * base (vista del directorio y trigger de mensajes); solo el administrador las cambia.
 */
export function SalesSettings() {
  const supabase = createClient();
  const { isAdmin, me } = useCrm();
  const [loaded, setLoaded] = useState(false);
  const [days, setDays] = useState("90");
  const [savedDays, setSavedDays] = useState(90);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["inactivity_days", "intent_keywords"])
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error(errorMessage(error, "No se pudo cargar la configuración"));
        const byKey = new Map((data ?? []).map((r) => [r.key, r.value]));
        const d = Number(byKey.get("inactivity_days") ?? 90);
        setDays(String(d));
        setSavedDays(d);
        setKeywords(toKeywords(byKey.get("intent_keywords")));
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function upsert(key: string, value: Json): Promise<boolean> {
    setBusy(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value, updated_by: me?.id ?? null, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      toast.error(errorMessage(error, "No se pudo guardar"));
      return false;
    }
    return true;
  }

  const daysValue = Number(days);
  const daysInvalid = !Number.isInteger(daysValue) || daysValue < 1 || daysValue > 3650;

  async function saveDays() {
    if (daysInvalid) return;
    if (await upsert("inactivity_days", daysValue)) {
      setSavedDays(daysValue);
      toast.success(`Un cliente queda inactivo tras ${daysValue} días sin comprar`);
    }
  }

  async function saveKeywords(next: string[]) {
    const previous = keywords;
    setKeywords(next);
    if (!(await upsert("intent_keywords", next))) setKeywords(previous);
  }

  function addKeyword() {
    const word = newKeyword.trim().toLowerCase().replace(/\s+/g, " ");
    if (!word) return;
    if (keywords.includes(word)) {
      toast.error("Esa palabra ya está en la lista");
      return;
    }
    setNewKeyword("");
    void saveKeywords([...keywords, word].sort((a, b) => a.localeCompare(b, "es")));
  }

  if (!loaded) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Contactos y ventas"
        description="Reglas que usa el CRM para clasificar. Nada se aplica solo: la palabra clave solo sugiere y el agente decide."
      />
      {!isAdmin && (
        <p className="rounded-lg bg-superficie-2 p-3 text-sm text-texto-suave">Solo un administrador puede cambiar estas reglas.</p>
      )}

      <div className="space-y-3 rounded-xl border p-5">
        <div className="space-y-1">
          <Label htmlFor="inactivity-days" className="text-sm font-medium">
            Días sin compra para «Inactivo»
          </Label>
          <p className="text-sm text-texto-suave">
            Un cliente sin compras registradas en este periodo se marca «Inactivo» (si nunca compró, cuenta desde que se
            clasificó como cliente).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="inactivity-days"
            type="number"
            inputMode="numeric"
            min={1}
            max={3650}
            className="w-28"
            value={days}
            disabled={!isAdmin}
            onChange={(e) => setDays(e.target.value)}
            aria-invalid={daysInvalid}
          />
          <span className="text-sm text-texto-suave">días</span>
          {isAdmin && (
            <Button size="sm" onClick={() => void saveDays()} disabled={busy || daysInvalid || daysValue === savedDays}>
              Guardar
            </Button>
          )}
        </div>
        {daysInvalid && <p className="text-xs text-error-texto">Escribe un número entero entre 1 y 3650.</p>}
      </div>

      <div className="space-y-3 rounded-xl border p-5">
        <div className="space-y-1">
          <p className="text-sm font-medium">Palabras de intención de compra</p>
          <p className="text-sm text-texto-suave">
            Si un contacto «Sin clasificar» escribe una de estas palabras (sin importar acentos ni mayúsculas; cuenta
            al inicio de una palabra: «obra» detecta «obras» pero no «maniobra»), el chat muestra «Posible prospecto»
            para aceptarlo o descartarlo.
          </p>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Palabras clave">
          {keywords.map((word) => (
            <li key={word} className="inline-flex h-7 items-center gap-1 rounded-full bg-superficie-2 pr-1 pl-3 text-sm">
              {word}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => void saveKeywords(keywords.filter((k) => k !== word))}
                  className="rounded-full p-1 text-texto-suave hover:bg-superficie-3 hover:text-texto"
                  aria-label={`Quitar «${word}»`}
                  disabled={busy}
                >
                  <Icon name="cerrar" className="size-3" />
                </button>
              )}
            </li>
          ))}
          {keywords.length === 0 && <li className="text-sm text-texto-suave">Sin palabras: no se harán sugerencias.</li>}
        </ul>
        {isAdmin && (
          <form
            className="flex max-w-md items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addKeyword();
            }}
          >
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="p. ej. «tabicón»"
              maxLength={40}
              aria-label="Nueva palabra clave"
            />
            <Button type="submit" variant="outline" disabled={busy || !newKeyword.trim()}>
              <Icon name="agregar" /> Agregar
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
