"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { TagChip } from "@/components/crm/tag-chip";
import { invalidateAgentNames } from "@/components/inbox/use-agent-names";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveAgentSettings, type Agent } from "@/lib/agents/client";
import { DISPLAY_NAME_MAX, type AgentLimits } from "@/lib/agents/config";
import {
  DEFAULT_NOTES_DISPLAY_NAME,
  formatSilence,
  NOTES_CAPTURE_OPTIONS,
  parseNotesConfig,
  SILENCE_PRESETS,
  type NotesAgentConfig,
  type NotesLimits,
} from "@/lib/agents/notes-config";
import { errorMessage } from "@/lib/crm/contacts";
import { CLASSIFICATION_LABELS, CLASSIFICATIONS } from "@/lib/crm/types";
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

function notesLimits(limits: AgentLimits): NotesLimits {
  return {
    daily_cap_max: limits.daily_cap_max,
    delay_seconds_min: limits.delay_seconds_min,
    delay_seconds_max: limits.delay_seconds_max,
  };
}

/**
 * Panel del CLIENTE del Asistente de notas: opciones cerradas y sin conceptos
 * técnicos. La base recorta y valida todo al guardar (update_agent_settings).
 */
export function NotesConfigForm({ agent, limits, canEdit, onSaved, onDirtyChange }: Props) {
  const supabase = createClient();
  const { tags } = useCrm();
  const range = notesLimits(limits);
  const [config, setConfig] = useState<NotesAgentConfig>(() => parseNotesConfig(agent.config, range));
  const [savedConfig, setSavedConfig] = useState<NotesAgentConfig>(() => parseNotesConfig(agent.config, range));
  const [customSilence, setCustomSilence] = useState(() => !SILENCE_PRESETS.some((p) => p.seconds === parseNotesConfig(agent.config, range).delay_seconds));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function patch<K extends keyof NotesAgentConfig>(key: K, value: Partial<NotesAgentConfig[K]> | NotesAgentConfig[K]) {
    setConfig((prev) => ({
      ...prev,
      [key]: typeof value === "object" && value !== null && !Array.isArray(value) ? { ...(prev[key] as object), ...value } : value,
    }));
  }

  const minMinutes = Math.ceil(range.delay_seconds_min / 60);
  const maxMinutes = Math.floor(range.delay_seconds_max / 60);

  function validate(): string | null {
    if (!config.display_name.trim()) return "Escribe un nombre para el asistente.";
    if (config.scope.classifications.length === 0) return "Elige al menos un tipo de contacto.";
    if (config.delay_seconds < range.delay_seconds_min || config.delay_seconds > range.delay_seconds_max) {
      return `Los minutos de silencio deben estar entre ${minMinutes} y ${maxMinutes}.`;
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
    const sent: NotesAgentConfig = { ...config, display_name: config.display_name.trim() };
    try {
      const saved = await saveAgentSettings(supabase, agent.key, { config: sent });
      const stored = parseNotesConfig(saved.config, range);
      const adjusted: string[] = [];
      if (stored.delay_seconds !== sent.delay_seconds) adjusted.push(`el silencio quedó en ${formatSilence(stored.delay_seconds)}`);
      if (stored.limits.daily_cap !== sent.limits.daily_cap) adjusted.push(`el límite por día quedó en ${stored.limits.daily_cap}`);
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

  const presetDisabled = (seconds: number) => seconds < range.delay_seconds_min || seconds > range.delay_seconds_max;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <fieldset disabled={!canEdit || saving} className="min-h-0 flex-1 overflow-y-auto">
        <ConfigSection title="Nombre" description="Así firma sus notas." defaultOpen>
          <div className="space-y-1.5">
            <Label htmlFor="na-name">Nombre del asistente</Label>
            <Input
              id="na-name"
              value={config.display_name}
              onChange={(e) => patch("display_name", e.target.value.slice(0, DISPLAY_NAME_MAX))}
              maxLength={DISPLAY_NAME_MAX}
              placeholder={DEFAULT_NOTES_DISPLAY_NAME}
            />
            <p className="flex justify-between text-xs text-texto-suave">
              <span>Aparece en sus notas y en el resumen del cliente.</span>
              <span className="tabular-nums">
                {config.display_name.length}/{DISPLAY_NAME_MAX}
              </span>
            </p>
          </div>
        </ConfigSection>

        <ConfigSection title="Qué anota" description="Lo que deja en las notas internas del chat.">
          <ul className="space-y-3">
            {NOTES_CAPTURE_OPTIONS.map((o) => (
              <li key={o.key}>
                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={config.capture[o.key]}
                    onCheckedChange={(checked) => patch("capture", { [o.key]: checked === true })}
                  />
                  <span>
                    <span className="block font-medium">{o.label}</span>
                    <span className="text-xs text-texto-suave">{o.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-texto-suave">El resumen del cliente se actualiza siempre. Nunca guarda tarjetas, contraseñas ni identificaciones.</p>
        </ConfigSection>

        <ConfigSection title="Cuándo anota" description="Después de que el cliente deja de escribir.">
          <div className="space-y-2">
            <Label>Minutos de silencio</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {SILENCE_PRESETS.map((p) => {
                const active = !customSilence && config.delay_seconds === p.seconds;
                return (
                  <button
                    key={p.seconds}
                    type="button"
                    aria-pressed={active}
                    disabled={presetDisabled(p.seconds)}
                    onClick={() => {
                      setCustomSilence(false);
                      patch("delay_seconds", p.seconds);
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50",
                      active ? "border-marca bg-marca-suave text-marca-texto" : "hover:bg-superficie-2",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={customSilence}
                onClick={() => setCustomSilence(true)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium",
                  customSilence ? "border-marca bg-marca-suave text-marca-texto" : "hover:bg-superficie-2",
                )}
              >
                {customSilence ? formatSilence(config.delay_seconds) : "Otro"}
              </button>
            </div>
            {customSilence && (
              <NumberField
                id="na-silence"
                label="Minutos"
                value={Math.round(config.delay_seconds / 60)}
                min={minMinutes}
                max={maxMinutes}
                onChange={(v) => patch("delay_seconds", v * 60)}
              />
            )}
            <p className="text-xs text-texto-suave">Si el cliente vuelve a escribir, la espera empieza de nuevo.</p>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            También al pasar el chat a una persona
            <Switch checked={config.on_handoff} onCheckedChange={(on) => patch("on_handoff", on)} />
          </label>
        </ConfigSection>

        <ConfigSection title="De quién anota" description="Por tipo de contacto y etiquetas.">
          <div className="grid grid-cols-2 gap-2">
            {CLASSIFICATIONS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={config.scope.classifications.includes(c)}
                  onCheckedChange={(checked) =>
                    patch("scope", {
                      classifications: checked ? [...config.scope.classifications, c] : config.scope.classifications.filter((x) => x !== c),
                    })
                  }
                />
                {CLASSIFICATION_LABELS[c]}
              </label>
            ))}
          </div>
          {tags.length > 0 && (
            <div className="space-y-2">
              <Label>No anotar a contactos con estas etiquetas</Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const on = config.scope.excluded_tag_ids.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        patch("scope", {
                          excluded_tag_ids: on ? config.scope.excluded_tag_ids.filter((x) => x !== tag.id) : [...config.scope.excluded_tag_ids, tag.id],
                        })
                      }
                      className={cn("rounded-full ring-offset-2 ring-offset-background", on ? "ring-2 ring-marca" : "opacity-60 hover:opacity-100")}
                    >
                      <TagChip tag={tag} size="xs" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </ConfigSection>

        <ConfigSection title="Límite" description="Cuántas veces puede anotar por día.">
          <NumberField
            id="na-daily"
            label="Pasadas máximas por día"
            value={config.limits.daily_cap}
            min={1}
            max={range.daily_cap_max}
            onChange={(v) => patch("limits", { daily_cap: v })}
            hint="Cada pasada revisa los mensajes nuevos de un chat."
          />
        </ConfigSection>

        <ConfigSection title="Avisos" description="Se muestran en esta página.">
          {(
            [
              ["on_daily_cap", "Cuando llegue al límite del día"],
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
