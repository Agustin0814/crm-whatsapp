"use client";

import { LockIcon } from "lucide-react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { saveAgentSettings, type Agent } from "@/lib/agents/client";
import {
  DELAY_PRESETS,
  DISPLAY_NAME_MAX,
  formatDelay,
  parseAgentConfig,
  SCHEDULE_MODE_LABELS,
  type AgentConfig,
  type AgentLimits,
  type ScheduleMode,
} from "@/lib/agents/config";
import { errorMessage } from "@/lib/crm/contacts";
import { CLASSIFICATION_LABELS, CLASSIFICATIONS, type QuickReply } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ConfigSection, RangeHint } from "./config-section";

const DAYS = [
  { n: 1, label: "L", name: "lunes" },
  { n: 2, label: "M", name: "martes" },
  { n: 3, label: "M", name: "miércoles" },
  { n: 4, label: "J", name: "jueves" },
  { n: 5, label: "V", name: "viernes" },
  { n: 6, label: "S", name: "sábado" },
  { n: 7, label: "D", name: "domingo" },
];

type ReplyRow = Pick<QuickReply, "id" | "shortcut" | "body" | "agent_permission">;

type Props = {
  agent: Agent;
  limits: AgentLimits;
  canEdit: boolean;
  onSaved: (agent: Agent) => void;
  /** Avisa al panel si hay cambios sin guardar (punto en la pestaña y aviso al cerrar). */
  onDirtyChange?: (dirty: boolean) => void;
};

/** Diferencias entre lo enviado y lo que guardó la base (que recorta y filtra). */
function describeAdjustments(sent: AgentConfig, saved: AgentConfig): string[] {
  const notes: string[] = [];
  if (sent.delay_seconds !== saved.delay_seconds) notes.push(`la espera quedó en ${formatDelay(saved.delay_seconds)}`);
  if (sent.limits.max_consecutive !== saved.limits.max_consecutive)
    notes.push(`las respuestas seguidas quedaron en ${saved.limits.max_consecutive}`);
  if (sent.limits.daily_cap !== saved.limits.daily_cap) notes.push(`el máximo por día quedó en ${saved.limits.daily_cap}`);
  if (sent.display_name !== saved.display_name) notes.push(`el nombre quedó como «${saved.display_name}»`);
  return notes;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/**
 * Panel del CLIENTE: solo opciones cerradas (nada de texto para el modelo,
 * modelos ni tokens). La base recorta y valida todo al guardar.
 */
export function AgentConfigForm({ agent, limits, canEdit, onSaved, onDirtyChange }: Props) {
  const supabase = createClient();
  const { tags } = useCrm();
  const [config, setConfig] = useState<AgentConfig>(() => parseAgentConfig(agent.config, limits));
  // Última versión guardada: con ella se calcula si hay cambios sin guardar.
  const [savedConfig, setSavedConfig] = useState<AgentConfig>(() => parseAgentConfig(agent.config, limits));
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const [customDelay, setCustomDelay] = useState(() => {
    const d = parseAgentConfig(agent.config, limits).delay_seconds;
    return !DELAY_PRESETS.some((p) => p.seconds === d);
  });
  const [replies, setReplies] = useState<ReplyRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("quick_replies")
      .select("id, shortcut, body, agent_permission")
      .order("shortcut")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error("No se pudieron cargar las respuestas rápidas");
        setReplies(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function patch<K extends keyof AgentConfig>(key: K, value: Partial<AgentConfig[K]> | AgentConfig[K]) {
    setConfig((prev) => ({
      ...prev,
      [key]: typeof value === "object" && value !== null && !Array.isArray(value) ? { ...(prev[key] as object), ...value } : value,
    }));
  }

  /** Mensaje claro si algo no se puede guardar (el servidor vuelve a validar). */
  function validate(): string | null {
    if (!config.display_name.trim()) return "Escribe un nombre para el asistente.";
    if (config.scope.classifications.length === 0) return "Elige al menos un tipo de contacto al que responda.";
    if (config.schedule.mode !== "always") {
      if (config.schedule.days.length === 0) return "Elige al menos un día del horario.";
      if (config.schedule.start === config.schedule.end) return "La hora de inicio y la de fin no pueden ser iguales.";
    }
    if (config.delay_seconds < limits.delay_seconds_min || config.delay_seconds > limits.delay_seconds_max) {
      return `La espera debe estar entre ${formatDelay(limits.delay_seconds_min)} y ${formatDelay(limits.delay_seconds_max)}.`;
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
    const sent: AgentConfig = { ...config, display_name: config.display_name.trim() };
    try {
      const saved = await saveAgentSettings(supabase, agent.key, { config: sent });
      const stored = parseAgentConfig(saved.config, limits);
      // Se comprueba lo que REALMENTE quedó en la base: nada se pierde en silencio.
      if (!sameIds(sent.quick_reply_ids, stored.quick_reply_ids)) {
        throw new Error("Las respuestas rápidas elegidas no se guardaron. Vuelve a abrir el panel e inténtalo de nuevo.");
      }
      const notes = describeAdjustments(sent, stored);
      setConfig(stored);
      setSavedConfig(stored);
      invalidateAgentNames();
      onSaved(saved);
      if (notes.length) toast.success(`Cambios guardados. Ajustamos a lo permitido: ${notes.join(", ")}.`);
      else toast.success("Cambios guardados");
    } catch (error) {
      const message = errorMessage(error, "No se pudieron guardar los cambios");
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const presetDisabled = (seconds: number) => seconds < limits.delay_seconds_min || seconds > limits.delay_seconds_max;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <fieldset disabled={!canEdit || saving} className="min-h-0 flex-1 overflow-y-auto">
        <ConfigSection title="Nombre" description="Así se identifica en el chat." defaultOpen>
          <div className="space-y-1.5">
            <Label htmlFor="ag-name">Nombre del asistente</Label>
            <Input
              id="ag-name"
              value={config.display_name}
              onChange={(e) => patch("display_name", e.target.value.slice(0, DISPLAY_NAME_MAX))}
              maxLength={DISPLAY_NAME_MAX}
              placeholder="Asistente"
            />
            <p className="flex justify-between text-xs text-texto-suave">
              <span>Aparece en la etiqueta de los mensajes que envía.</span>
              <span className="tabular-nums">
                {config.display_name.length}/{DISPLAY_NAME_MAX}
              </span>
            </p>
          </div>
        </ConfigSection>

        <ConfigSection title="Tono" description="Cómo escribe.">
          <Segmented
            label="Trato"
            value={config.tone.pronoun}
            options={{ tu: "De tú", usted: "De usted" }}
            onChange={(v) => patch("tone", { pronoun: v })}
          />
          <Segmented
            label="Estilo"
            value={config.tone.style}
            options={{ cercano: "Cercano", formal: "Formal" }}
            onChange={(v) => patch("tone", { style: v })}
          />
          <Segmented
            label="Emojis"
            value={config.tone.emojis}
            options={{ ninguno: "Ninguno", pocos: "Pocos", libres: "Varios" }}
            onChange={(v) => patch("tone", { emojis: v })}
          />
          <Segmented
            label="Largo de las respuestas"
            value={config.tone.length}
            options={{ corta: "Cortas", media: "Medias" }}
            onChange={(v) => patch("tone", { length: v })}
          />
        </ConfigSection>

        <ConfigSection title="Cuándo responde" description="Horario y espera antes de contestar.">
          <Segmented
            label="Horario"
            value={config.schedule.mode}
            options={SCHEDULE_MODE_LABELS}
            onChange={(v: ScheduleMode) => patch("schedule", { mode: v })}
          />
          {config.schedule.mode !== "always" && (
            <div className="space-y-3 rounded-xl border p-3">
              <p className="text-xs text-texto-suave">
                {config.schedule.mode === "after_hours"
                  ? "Tu horario de atención: el asistente responde FUERA de él."
                  : "El asistente responde solo DENTRO de este horario."}{" "}
                Hora de Hermosillo.
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días">
                {DAYS.map((d) => {
                  const on = config.schedule.days.includes(d.n);
                  return (
                    <button
                      key={d.n}
                      type="button"
                      aria-pressed={on}
                      aria-label={d.name}
                      onClick={() =>
                        patch("schedule", {
                          days: on ? config.schedule.days.filter((x) => x !== d.n) : [...config.schedule.days, d.n].sort(),
                        })
                      }
                      className={cn(
                        "size-9 rounded-full border text-sm font-medium",
                        on ? "border-transparent bg-primary text-primary-foreground" : "text-texto-suave hover:bg-superficie-2",
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ag-start">Desde</Label>
                  <Input id="ag-start" type="time" value={config.schedule.start} onChange={(e) => patch("schedule", { start: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ag-end">Hasta</Label>
                  <Input id="ag-end" type="time" value={config.schedule.end} onChange={(e) => patch("schedule", { end: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Espera antes de responder</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DELAY_PRESETS.map((p) => {
                const active = !customDelay && config.delay_seconds === p.seconds;
                return (
                  <button
                    key={p.seconds}
                    type="button"
                    aria-pressed={active}
                    disabled={presetDisabled(p.seconds)}
                    onClick={() => {
                      setCustomDelay(false);
                      patch("delay_seconds", p.seconds);
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-sm disabled:opacity-50",
                      active ? "border-marca bg-marca-suave text-marca-texto" : "hover:bg-superficie-2",
                    )}
                  >
                    <span className="block font-medium">{p.label}</span>
                    <span className="text-xs text-texto-suave">{p.hint}</span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={customDelay}
                onClick={() => setCustomDelay(true)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left text-sm",
                  customDelay ? "border-marca bg-marca-suave text-marca-texto" : "hover:bg-superficie-2",
                )}
              >
                <span className="block font-medium">Personalizada</span>
                <span className="text-xs text-texto-suave">{customDelay ? formatDelay(config.delay_seconds) : "En segundos"}</span>
              </button>
            </div>
            {customDelay && (
              <NumberField
                id="ag-delay"
                label="Segundos"
                value={config.delay_seconds}
                min={limits.delay_seconds_min}
                max={limits.delay_seconds_max}
                onChange={(v) => patch("delay_seconds", v)}
              />
            )}
            <p className="text-xs text-texto-suave">
              Si una persona de tu equipo responde o abre el chat durante la espera, el asistente no contesta.
            </p>
          </div>
        </ConfigSection>

        <ConfigSection title="A quién le responde" description="Por tipo de contacto y etiquetas.">
          <div className="grid grid-cols-2 gap-2">
            {CLASSIFICATIONS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={config.scope.classifications.includes(c)}
                  onCheckedChange={(checked) =>
                    patch("scope", {
                      classifications: checked
                        ? [...config.scope.classifications, c]
                        : config.scope.classifications.filter((x) => x !== c),
                    })
                  }
                />
                {CLASSIFICATION_LABELS[c]}
              </label>
            ))}
          </div>
          {tags.length > 0 && (
            <div className="space-y-2">
              <Label>No responder a contactos con estas etiquetas</Label>
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
                          excluded_tag_ids: on
                            ? config.scope.excluded_tag_ids.filter((x) => x !== tag.id)
                            : [...config.scope.excluded_tag_ids, tag.id],
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

        <ConfigSection title="Límites" description="Para que una persona tome el control a tiempo.">
          <NumberField
            id="ag-consecutive"
            label="Respuestas seguidas sin que intervenga una persona"
            value={config.limits.max_consecutive}
            min={limits.max_consecutive_min}
            max={limits.max_consecutive_max}
            onChange={(v) => patch("limits", { max_consecutive: v })}
            hint="Al llegar, pasa el chat a una persona."
          />
          <NumberField
            id="ag-daily"
            label="Respuestas máximas por día"
            value={config.limits.daily_cap}
            min={limits.daily_cap_min}
            max={limits.daily_cap_max}
            onChange={(v) => patch("limits", { daily_cap: v })}
          />
        </ConfigSection>

        <ConfigSection title="Respuestas rápidas que puede usar" description="Enciende las que el asistente puede enviar.">
          {replies === null ? (
            <p className="text-sm text-texto-suave">Cargando…</p>
          ) : replies.length === 0 ? (
            <p className="text-sm text-texto-suave">Aún no hay respuestas rápidas. Créalas en Configuración → Respuestas rápidas.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {replies.map((r) => {
                const teamOnly = r.agent_permission === "human_only";
                const on = !teamOnly && config.quick_reply_ids.includes(r.id);
                return (
                  <li key={r.id} className={cn("flex items-center gap-3 px-3 py-2.5", teamOnly && "text-texto-suave")}>
                    <div className="min-w-0 flex-1">
                      <code className="text-sm font-semibold">/{r.shortcut}</code>
                      <p className="truncate text-xs text-texto-suave">{r.body}</p>
                    </div>
                    {teamOnly && (
                      <span className="flex shrink-0 items-center gap-1 text-xs">
                        <LockIcon className="size-3.5" aria-hidden /> Solo tu equipo
                      </span>
                    )}
                    <Switch
                      checked={on}
                      disabled={teamOnly}
                      onCheckedChange={(checked) =>
                        patch(
                          "quick_reply_ids",
                          checked ? [...config.quick_reply_ids, r.id] : config.quick_reply_ids.filter((id) => id !== r.id),
                        )
                      }
                      aria-label={teamOnly ? `/${r.shortcut}: solo tu equipo` : `Permitir /${r.shortcut} al asistente`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </ConfigSection>

        <ConfigSection title="Avisos" description="Se muestran en esta página.">
          {(
            [
              ["on_handoff", "Cuando pase un chat a una persona"],
              ["on_daily_cap", "Cuando llegue al límite de respuestas del día"],
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

/** Selector segmentado con etiqueta (opciones cerradas). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
        aria-label={label}
        className="flex-wrap"
      >
        {(Object.keys(options) as T[]).map((k) => (
          <ToggleGroupItem key={k} value={k}>
            {options[k]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** Campo numérico acotado: recorta al salir del campo (la base vuelve a recortar). */
export function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  // Si el valor cambia desde fuera (p. ej. tras guardar), se sincroniza el texto.
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        className="w-28"
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // Un valor válido cuenta de inmediato (no hay que salir del campo para que «Guardar» lo vea).
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isInteger(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          const n = Number(text);
          const clamped = Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : value;
          setText(String(clamped));
          onChange(clamped);
        }}
      />
      <RangeHint min={min} max={max} />
      {hint && <p className="text-xs text-texto-suave">{hint}</p>}
    </div>
  );
}
