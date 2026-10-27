"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { invalidateAgentNames } from "@/components/inbox/use-agent-names";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveAgentSettings, type Agent } from "@/lib/agents/client";
import { DISPLAY_NAME_MAX, type AgentLimits } from "@/lib/agents/config";
import {
  DEFAULT_SYSTEM_DISPLAY_NAME,
  parseSystemConfig,
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  SYSTEM_ALLOWED_ROLES_LABELS,
  type SystemAgentConfig,
  type SystemAllowedRoles,
} from "@/lib/agents/system-config";
import { errorMessage } from "@/lib/crm/contacts";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NumberField } from "./agent-config-form";
import { ConfigSection } from "./config-section";

type Props = {
  agent: Agent;
  limits: AgentLimits;
  canEdit: boolean;
  onSaved: (agent: Agent) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const DEFAULT_RETENTION = 90;

/**
 * Panel del CLIENTE del Asistente del sistema: opciones cerradas y sin
 * conceptos técnicos. La base recorta y valida todo al guardar.
 */
export function SystemConfigForm({ agent, limits, canEdit, onSaved, onDirtyChange }: Props) {
  const supabase = createClient();
  const max = limits.questions_per_person_max;
  const [config, setConfig] = useState<SystemAgentConfig>(() => parseSystemConfig(agent.config, max));
  const [savedConfig, setSavedConfig] = useState<SystemAgentConfig>(() => parseSystemConfig(agent.config, max));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function patch<K extends keyof SystemAgentConfig>(key: K, value: Partial<SystemAgentConfig[K]> | SystemAgentConfig[K]) {
    setConfig((prev) => ({
      ...prev,
      [key]: typeof value === "object" && value !== null && !Array.isArray(value) ? { ...(prev[key] as object), ...value } : value,
    }));
  }

  function validate(): string | null {
    if (!config.display_name.trim()) return "Escribe un nombre para el asistente.";
    if (config.saved_retention_days !== null && (config.saved_retention_days < RETENTION_MIN_DAYS || config.saved_retention_days > RETENTION_MAX_DAYS)) {
      return `Los días deben estar entre ${RETENTION_MIN_DAYS} y ${RETENTION_MAX_DAYS}.`;
    }
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) {
      setSaveError(problem);
      toast.error(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const sent: SystemAgentConfig = { ...config, display_name: config.display_name.trim() };
    try {
      const saved = await saveAgentSettings(supabase, agent.key, { config: sent });
      const stored = parseSystemConfig(saved.config, max);
      const adjusted: string[] = [];
      if (stored.limits.daily_questions_per_person !== sent.limits.daily_questions_per_person) {
        adjusted.push(`las preguntas por día quedaron en ${stored.limits.daily_questions_per_person}`);
      }
      if (stored.saved_retention_days !== sent.saved_retention_days) adjusted.push(`los días quedaron en ${stored.saved_retention_days ?? "nunca"}`);
      if (stored.display_name !== sent.display_name) adjusted.push(`el nombre quedó como «${stored.display_name}»`);
      setConfig(stored);
      setSavedConfig(stored);
      invalidateAgentNames();
      onSaved(saved);
      toast.success(adjusted.length ? `Cambios guardados. Ajustamos a lo permitido: ${adjusted.join(", ")}.` : "Cambios guardados");
    } catch (error) {
      const message = errorMessage(error, "No se pudieron guardar los cambios");
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <fieldset disabled={!canEdit || saving} className="min-h-0 flex-1 overflow-y-auto">
        <ConfigSection title="Nombre" description="Así se presenta con tu equipo." defaultOpen>
          <div className="space-y-1.5">
            <Label htmlFor="sa-name">Nombre visible</Label>
            <Input
              id="sa-name"
              value={config.display_name}
              onChange={(e) => patch("display_name", e.target.value.slice(0, DISPLAY_NAME_MAX))}
              maxLength={DISPLAY_NAME_MAX}
              placeholder={DEFAULT_SYSTEM_DISPLAY_NAME}
            />
            <p className="flex justify-between text-xs text-texto-suave">
              <span>Aparece en la burbuja y en la sección Asistente.</span>
              <span className="tabular-nums">
                {config.display_name.length}/{DISPLAY_NAME_MAX}
              </span>
            </p>
          </div>
        </ConfigSection>

        <ConfigSection title="Quién puede usarlo" description="Las personas con ese rol ven la burbuja y la sección Asistente.">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Quién puede usarlo">
            {(Object.keys(SYSTEM_ALLOWED_ROLES_LABELS) as SystemAllowedRoles[]).map((value) => {
              const active = config.allowed_roles === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => patch("allowed_roles", value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm font-medium",
                    active ? "border-marca bg-marca-suave text-marca-texto" : "hover:bg-superficie-2",
                  )}
                >
                  {SYSTEM_ALLOWED_ROLES_LABELS[value]}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-texto-suave">Los costos y el registro de actividad solo los ven los administradores.</p>
        </ConfigSection>

        <ConfigSection title="Chats" description="Dónde puede conversar tu equipo con el asistente.">
          <label className="flex items-start justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Chat temporal (burbuja)</span>
              <span className="text-xs text-texto-suave">No se guarda: se borra al cerrarlo o al recargar.</span>
            </span>
            <Switch checked={config.temp_chat} onCheckedChange={(on) => patch("temp_chat", on)} />
          </label>
          <label className="flex items-start justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Chats guardados</span>
              <span className="text-xs text-texto-suave">Con nombre, en la sección Asistente. Son compartidos con el equipo.</span>
            </span>
            <Switch checked={config.saved_chats} onCheckedChange={(on) => patch("saved_chats", on)} />
          </label>
          {config.saved_chats && (
            <div className="space-y-2 rounded-xl border p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                Borrar chats guardados sin actividad
                <Switch
                  checked={config.saved_retention_days !== null}
                  onCheckedChange={(on) => patch("saved_retention_days", on ? DEFAULT_RETENTION : null)}
                />
              </label>
              {config.saved_retention_days !== null && (
                <NumberField
                  id="sa-retention"
                  label="Días sin actividad"
                  value={config.saved_retention_days}
                  min={RETENTION_MIN_DAYS}
                  max={RETENTION_MAX_DAYS}
                  onChange={(v) => patch("saved_retention_days", v)}
                />
              )}
            </div>
          )}
        </ConfigSection>

        <ConfigSection title="Tareas que puede pedir" description="Siempre con tu confirmación: muestra una tarjeta y nada pasa hasta que la confirmas.">
          {(
            [
              ["notes_run_now", "Pedir notas de un chat", "El Asistente de notas anota ese chat en el momento."],
              ["responder_pause", "Pausar el asistente en un chat", "Pausa o reanuda el Asistente de respuestas en ese chat."],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="flex items-start gap-2.5 text-sm">
              <Checkbox className="mt-0.5" checked={config.delegations[key]} onCheckedChange={(on) => patch("delegations", { [key]: on === true })} />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="text-xs text-texto-suave">{hint}</span>
              </span>
            </label>
          ))}
        </ConfigSection>

        <ConfigSection title="Límite" description="Para cuidar el consumo.">
          <NumberField
            id="sa-daily"
            label="Preguntas máximas por persona al día"
            value={config.limits.daily_questions_per_person}
            min={1}
            max={max}
            onChange={(v) => patch("limits", { daily_questions_per_person: v })}
          />
        </ConfigSection>

        <ConfigSection title="Avisos" description="Se muestran en esta página.">
          {(
            [
              ["on_daily_cap", "Cuando alguien llegue al límite del día"],
              ["on_monthly_threshold", "Cuando se acerque al límite del mes"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 text-sm">
              {label}
              <Switch checked={config.alerts[key]} onCheckedChange={(on) => patch("alerts", { [key]: on })} />
            </label>
          ))}
        </ConfigSection>
      </fieldset>

      {canEdit && (
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
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
