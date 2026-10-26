"use client";

import { ShieldAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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

/**
 * Capa bloqueada (solo superadmin; la RLS no la devuelve a nadie más):
 * identidad, reglas, modelo, tokens, techos y kill switch.
 */
export function LockedConfigForm({ agentId, onSaved }: { agentId: string; onSaved: () => void }) {
  const supabase = createClient();
  const [values, setValues] = useState<Values | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLockedConfig(supabase, agentId)
      .then((row) => {
        if (cancelled || !row) return;
        setValues(toValues(row));
      })
      .catch(() => toast.error("No se pudo cargar la capa bloqueada"));
    return () => {
      cancelled = true;
    };
  }, [supabase, agentId]);

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
    setSaving(true);
    try {
      const saved = await saveLockedConfig(supabase, agentId, values);
      setValues(toValues(saved));
      onSaved();
      toast.success("Capa bloqueada guardada");
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo guardar la capa bloqueada"));
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
      <div className="flex justify-end border-t px-5 py-3">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar capa bloqueada"}
        </Button>
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
