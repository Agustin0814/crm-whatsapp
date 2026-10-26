"use client";

import { ShieldAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchLockedConfig, saveLockedConfig, type AgentLockedConfig } from "@/lib/agents/client";
import { errorMessage } from "@/lib/crm/contacts";
import { createClient } from "@/lib/supabase/client";
import { ConfigSection } from "./config-section";

const TOOLS = [
  { name: "enviar_respuesta_rapida", label: "Enviar respuesta rápida" },
  { name: "responder_texto_corto", label: "Responder texto corto" },
  { name: "transferir_a_humano", label: "Transferir a una persona" },
];

type Values = Omit<AgentLockedConfig, "agent_id" | "updated_at" | "updated_by">;

/** Solo los campos editables (sin id ni auditoría). */
function toValues(row: AgentLockedConfig): Values {
  const values: Partial<AgentLockedConfig> = { ...row };
  delete values.agent_id;
  delete values.updated_at;
  delete values.updated_by;
  return values as Values;
}

const NO_ASSIGNEE = "__nadie__";

/**
 * Capa del proveedor (solo superadmin; la RLS no la devuelve a nadie más):
 * identidad, reglas, información del negocio, escalamiento y traspaso,
 * modelo, techos, rango de espera, umbral de aviso y kill switch.
 */
/** Nombres legibles para avisar qué campo no quedó guardado. */
const FIELD_LABELS: Partial<Record<keyof Values, string>> = {
  system_prompt: "identidad",
  safety_rules: "reglas de seguridad",
  business_info: "información del negocio",
  escalation_topics: "temas de escalamiento",
  handoff_message: "mensaje de traspaso",
  handoff_assign_to: "asignar a",
  model: "modelo",
  temperature: "temperatura",
  max_output_tokens: "máx. tokens de salida",
  reasoning_effort: "esfuerzo de razonamiento",
  allowed_tools: "herramientas",
  max_consecutive_ceiling: "máx. respuestas seguidas",
  daily_cap_ceiling: "tope diario máximo",
  monthly_token_cap: "tope mensual de tokens",
  input_price_per_mtok: "precio de entrada",
  output_price_per_mtok: "precio de salida",
  delay_seconds_min: "espera mínima",
  delay_seconds_max: "espera máxima",
  max_wait_seconds: "tope de espera total",
  monthly_alert_threshold_pct: "aviso del mes",
  kill_switch: "kill switch",
};

/** Compara un campo enviado con el guardado (los numeric pueden volver como texto). */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === "number" || typeof b === "number") return a === null || b === null ? a === b : Number(a) === Number(b);
  return JSON.stringify(a) === JSON.stringify(b);
}

function changedKeys(a: Values, b: Values): (keyof Values)[] {
  return (Object.keys(a) as (keyof Values)[]).filter((k) => !sameValue(a[k], b[k]));
}

type Props = {
  agentId: string;
  onSaved: () => void;
  /** Avisa al panel si hay cambios sin guardar (punto en la pestaña y aviso al cerrar). */
  onDirtyChange?: (dirty: boolean) => void;
};

export function LockedConfigForm({ agentId, onSaved, onDirtyChange }: Props) {
  const supabase = createClient();
  const { profiles } = useCrm();
  const [values, setValues] = useState<Values | null>(null);
  // Última versión guardada en la base: referencia para «cambios sin guardar».
  const [savedValues, setSavedValues] = useState<Values | null>(null);
  const [topicsText, setTopicsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = values !== null && savedValues !== null && changedKeys(values, savedValues).length > 0;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    let cancelled = false;
    fetchLockedConfig(supabase, agentId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setLoadError("No tienes acceso a esta configuración.");
          return;
        }
        setValues(toValues(row));
        setSavedValues(toValues(row));
        setTopicsText(row.escalation_topics.join(", "));
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorMessage(error, "No se pudo cargar la capa del proveedor"));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, agentId]);

  if (loadError) {
    return (
      <p role="alert" className="m-5 rounded-lg bg-error-suave px-3 py-2 text-sm text-error-texto">
        {loadError}
      </p>
    );
  }
  if (!values) return <p className="px-5 py-4 text-sm text-texto-suave">Cargando…</p>;

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function num(text: string, fallback: number): number {
    const n = Number(text);
    return Number.isFinite(n) ? n : fallback;
  }

  async function save() {
    if (!values) return;
    if (values.delay_seconds_min > values.delay_seconds_max) {
      setSaveError("La espera mínima no puede ser mayor que la máxima.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const sent = values;
    try {
      const saved = toValues(await saveLockedConfig(supabase, agentId, sent));
      // Se comprueba campo por campo lo que REALMENTE quedó en la base.
      const lost = changedKeys(sent, saved);
      setValues(saved);
      setSavedValues(saved);
      setTopicsText(saved.escalation_topics.join(", "));
      onSaved();
      if (lost.length) {
        const message = `No se guardó: ${lost.map((k) => FIELD_LABELS[k] ?? k).join(", ")}. Revisa el valor e inténtalo de nuevo.`;
        setSaveError(message);
        toast.error(message);
      } else {
        toast.success("Capa del proveedor guardada");
      }
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar la capa del proveedor");
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <fieldset disabled={saving} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b bg-error-suave px-5 py-3 text-error-texto">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlertIcon className="size-4" aria-hidden /> Kill switch: detener el asistente
          </p>
          <Switch checked={values.kill_switch} onCheckedChange={(on) => set("kill_switch", on)} aria-label="Kill switch" />
        </div>

        <ConfigSection title="Identidad y reglas" description="Siempre van primero en el prompt." defaultOpen>
          <div className="space-y-1.5">
            <Label htmlFor="lk-prompt">Identidad / rol</Label>
            <Textarea id="lk-prompt" rows={5} value={values.system_prompt} onChange={(e) => set("system_prompt", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lk-rules">Reglas de seguridad</Label>
            <Textarea id="lk-rules" rows={8} value={values.safety_rules} onChange={(e) => set("safety_rules", e.target.value)} />
          </div>
        </ConfigSection>

        <ConfigSection title="Información del negocio" description="Única fuente de datos del asistente.">
          <Textarea
            rows={8}
            maxLength={8000}
            value={values.business_info}
            onChange={(e) => set("business_info", e.target.value)}
            placeholder="Qué hacen, productos y medidas, cobertura, horarios, ubicación, formas de pago…"
            aria-label="Información del negocio"
          />
        </ConfigSection>

        <ConfigSection title="Escalamiento y traspaso" description="Regla fija: pasa a una persona si el cliente lo pide o si no sabe.">
          <div className="space-y-1.5">
            <Label htmlFor="lk-topics">Temas que siempre pasan a una persona</Label>
            <Input
              id="lk-topics"
              value={topicsText}
              onChange={(e) => {
                setTopicsText(e.target.value);
                set(
                  "escalation_topics",
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                );
              }}
              placeholder="queja, factura, garantía"
            />
            <p className="text-xs text-texto-suave">Separados por comas. Se detectan sin acentos ni mayúsculas.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lk-handoff">Mensaje de traspaso</Label>
            <Textarea
              id="lk-handoff"
              rows={2}
              maxLength={500}
              value={values.handoff_message}
              onChange={(e) => set("handoff_message", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lk-assign">Asignar a</Label>
            <Select
              value={values.handoff_assign_to ?? NO_ASSIGNEE}
              onValueChange={(v) => set("handoff_assign_to", v === NO_ASSIGNEE ? null : v)}
            >
              <SelectTrigger id="lk-assign" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={NO_ASSIGNEE}>Nadie (solo pausar)</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {profileName(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ConfigSection>

        <ConfigSection
          title="Espera y avisos"
          description="Rango de espera del cliente. Cada mensaje nuevo reinicia la espera, sin pasar del tope total desde el primer mensaje sin responder."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInput id="lk-dmin" label="Espera mínima (s)" value={values.delay_seconds_min} onChange={(v) => set("delay_seconds_min", v)} />
            <NumberInput id="lk-dmax" label="Espera máxima (s, hasta 3600)" value={values.delay_seconds_max} onChange={(v) => set("delay_seconds_max", v)} />
            <NumberInput
              id="lk-maxwait"
              label="Tope de espera total (s, 10–600)"
              value={values.max_wait_seconds}
              onChange={(v) => set("max_wait_seconds", v)}
            />
            <NumberInput
              id="lk-threshold"
              label="Aviso de límite del mes (%)"
              value={values.monthly_alert_threshold_pct}
              onChange={(v) => set("monthly_alert_threshold_pct", v)}
            />
          </div>
        </ConfigSection>

        <ConfigSection title="Modelo" description="Proveedor OpenAI (Responses API).">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lk-model">Modelo</Label>
              <Input id="lk-model" value={values.model} onChange={(e) => set("model", e.target.value.trim())} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lk-effort">Esfuerzo de razonamiento</Label>
              <Select value={values.reasoning_effort} onValueChange={(v) => set("reasoning_effort", v)}>
                <SelectTrigger id="lk-effort" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="minimal">Mínimo</SelectItem>
                  <SelectItem value="low">Bajo</SelectItem>
                  <SelectItem value="medium">Medio</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lk-tokens">Máx. tokens de salida por respuesta</Label>
              <Input
                id="lk-tokens"
                type="number"
                min={64}
                max={8000}
                value={values.max_output_tokens}
                onChange={(e) => set("max_output_tokens", num(e.target.value, values.max_output_tokens))}
              />
              <p className="text-xs text-texto-suave">Incluye el razonamiento. 64–8000.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lk-temp">Temperatura</Label>
              <Input
                id="lk-temp"
                type="number"
                step="0.1"
                min={0}
                max={2}
                value={values.temperature ?? ""}
                placeholder="Predeterminada"
                onChange={(e) => set("temperature", e.target.value === "" ? null : num(e.target.value, 0))}
              />
              <p className="text-xs text-texto-suave">Vacía = la del modelo (los de razonamiento no la aceptan).</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Herramientas permitidas</Label>
            {TOOLS.map((t) => (
              <label key={t.name} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.allowed_tools.includes(t.name)}
                  onCheckedChange={(on) =>
                    set("allowed_tools", on ? [...values.allowed_tools, t.name] : values.allowed_tools.filter((x) => x !== t.name))
                  }
                />
                {t.label}
              </label>
            ))}
          </div>
        </ConfigSection>

        <ConfigSection title="Techos y costos" description="El cliente no puede superar estos valores.">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInput id="lk-cons" label="Máx. respuestas seguidas (1–10)" value={values.max_consecutive_ceiling} onChange={(v) => set("max_consecutive_ceiling", v)} />
            <NumberInput id="lk-daily" label="Tope diario máximo" value={values.daily_cap_ceiling} onChange={(v) => set("daily_cap_ceiling", v)} />
            <NumberInput id="lk-month" label="Tope mensual de tokens" value={values.monthly_token_cap} onChange={(v) => set("monthly_token_cap", v)} />
            <div />
            <NumberInput id="lk-in" label="USD por millón (entrada)" step="0.01" value={Number(values.input_price_per_mtok)} onChange={(v) => set("input_price_per_mtok", v)} />
            <NumberInput id="lk-out" label="USD por millón (salida)" step="0.01" value={Number(values.output_price_per_mtok)} onChange={(v) => set("output_price_per_mtok", v)} />
          </div>
        </ConfigSection>
      </fieldset>
      <div className="space-y-2 border-t px-5 py-3">
        {saveError && (
          <p role="alert" className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error-texto">
            {saveError}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-texto-suave" aria-live="polite">
            {dirty ? "Cambios sin guardar" : "Todo guardado"}
          </span>
          <Button onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Guardando…" : "Guardar capa del proveedor"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  step,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}
