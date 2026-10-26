"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveAgentSettings, type Agent } from "@/lib/agents/client";
import {
  isQuickReplyPermission,
  parseAgentConfig,
  QUICK_REPLY_PERMISSION_LABELS,
  SCHEDULE_MODE_LABELS,
  type AgentConfig,
  type AgentLimits,
  type QuickReplyPermission,
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

const NO_ASSIGNEE = "__nadie__";

type ReplyDraft = Pick<QuickReply, "id" | "shortcut" | "body" | "when_to_use"> & { agent_permission: QuickReplyPermission };

type Props = {
  agent: Agent;
  limits: AgentLimits;
  canEdit: boolean;
  onSaved: (agent: Agent) => void;
};

/** Capa editable por el cliente. La base recorta los valores al guardar. */
export function AgentConfigForm({ agent, limits, canEdit, onSaved }: Props) {
  const supabase = createClient();
  const { profiles, tags } = useCrm();
  const [config, setConfig] = useState<AgentConfig>(() => parseAgentConfig(agent.config, limits));
  const [topicsText, setTopicsText] = useState(() => parseAgentConfig(agent.config, limits).escalation.topics.join(", "));
  const [replies, setReplies] = useState<ReplyDraft[] | null>(null);
  const [originalReplies, setOriginalReplies] = useState<ReplyDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("quick_replies")
      .select("id, shortcut, body, when_to_use, agent_permission")
      .order("shortcut")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("No se pudieron cargar las respuestas rápidas");
          setReplies([]);
          return;
        }
        const list = data.map((r) => ({
          ...r,
          agent_permission: isQuickReplyPermission(r.agent_permission) ? r.agent_permission : "human_only",
        }));
        setReplies(list);
        setOriginalReplies(list);
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

  function patchReply(id: string, changes: Partial<ReplyDraft>) {
    setReplies((prev) => prev?.map((r) => (r.id === id ? { ...r, ...changes } : r)) ?? prev);
  }

  async function save() {
    setSaving(true);
    try {
      const topics = topicsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const saved = await saveAgentSettings(supabase, agent.key, {
        config: { ...config, escalation: { ...config.escalation, topics } },
      });
      // Solo las respuestas rápidas que cambiaron.
      const changed = (replies ?? []).filter((r) => {
        const o = originalReplies.find((x) => x.id === r.id);
        return o && (o.agent_permission !== r.agent_permission || (o.when_to_use ?? "") !== (r.when_to_use ?? ""));
      });
      for (const r of changed) {
        const { error } = await supabase
          .from("quick_replies")
          .update({ agent_permission: r.agent_permission, when_to_use: r.when_to_use?.trim() || null })
          .eq("id", r.id);
        if (error) throw error;
      }
      if (replies) setOriginalReplies(replies);
      const parsed = parseAgentConfig(saved.config, limits);
      setConfig(parsed);
      setTopicsText(parsed.escalation.topics.join(", "));
      onSaved(saved);
      toast.success("Configuración guardada");
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo guardar la configuración"));
    } finally {
      setSaving(false);
    }
  }

  const instructionsLeft = limits.extra_instructions_max - config.extra_instructions.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <fieldset disabled={!canEdit || saving} className="min-h-0 flex-1 overflow-y-auto">
        <ConfigSection title="Información del negocio" description="Lo único que el asistente puede usar para responder." defaultOpen>
          <Textarea
            value={config.business_info}
            onChange={(e) => patch("business_info", e.target.value)}
            rows={8}
            maxLength={limits.business_info_max}
            placeholder="Qué hacen, productos y medidas, cobertura, horarios, ubicación, formas de pago…"
            aria-label="Información del negocio"
          />
          <p className="text-right text-xs text-texto-suave">
            {config.business_info.length} / {limits.business_info_max}
          </p>
        </ConfigSection>

        <ConfigSection title="Tono" description="Cómo escribe el asistente.">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceSelect
              label="Estilo"
              value={config.tone.style}
              options={{ cercano: "Cercano", formal: "Formal" }}
              onChange={(v) => patch("tone", { style: v })}
            />
            <ChoiceSelect
              label="Trato"
              value={config.tone.pronoun}
              options={{ tu: "Tú", usted: "Usted" }}
              onChange={(v) => patch("tone", { pronoun: v })}
            />
            <ChoiceSelect
              label="Emojis"
              value={config.tone.emojis}
              options={{ ninguno: "Ninguno", pocos: "Pocos", libres: "Con moderación" }}
              onChange={(v) => patch("tone", { emojis: v })}
            />
            <ChoiceSelect
              label="Longitud"
              value={config.tone.length}
              options={{ corta: "Muy corta", media: "Breve" }}
              onChange={(v) => patch("tone", { length: v })}
            />
          </div>
        </ConfigSection>

        <ConfigSection title="Cuándo actúa" description="Horario, retraso y a quién responde.">
          <ChoiceSelect
            label="Horario"
            value={config.schedule.mode}
            options={SCHEDULE_MODE_LABELS}
            onChange={(v: ScheduleMode) => patch("schedule", { mode: v })}
          />
          {config.schedule.mode !== "always" && (
            <div className="space-y-3 rounded-xl border p-3">
              <p className="text-xs text-texto-suave">
                {config.schedule.mode === "after_hours"
                  ? "Horario de atención de tu equipo: el asistente responde FUERA de él."
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

          <NumberField
            id="ag-delay"
            label="Retraso de respuesta (minutos)"
            value={config.delay_minutes}
            min={limits.delay_minutes_min}
            max={limits.delay_minutes_max}
            onChange={(v) => patch("delay_minutes", v)}
            hint="Da tiempo a que una persona conteste primero. Con 0 responde al instante."
          />

          <div className="space-y-2">
            <Label>Responde a</Label>
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
          </div>

          {tags.length > 0 && (
            <div className="space-y-2">
              <Label>Etiquetas excluidas</Label>
              <p className="text-xs text-texto-suave">Nunca responde a contactos con estas etiquetas.</p>
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

        <ConfigSection title="Límites" description="Topes por chat y por día.">
          <NumberField
            id="ag-consecutive"
            label="Respuestas seguidas sin que intervenga una persona"
            value={config.limits.max_consecutive}
            min={limits.max_consecutive_min}
            max={limits.max_consecutive_max}
            onChange={(v) => patch("limits", { max_consecutive: v })}
            hint="Al llegar, transfiere a una persona y se pausa en ese chat."
          />
          <NumberField
            id="ag-daily"
            label="Tope diario de respuestas"
            value={config.limits.daily_cap}
            min={limits.daily_cap_min}
            max={limits.daily_cap_max}
            onChange={(v) => patch("limits", { daily_cap: v })}
          />
        </ConfigSection>

        <ConfigSection title="Respuestas rápidas que puede usar" description="Elige cuáles y cuándo.">
          {replies === null ? (
            <p className="text-sm text-texto-suave">Cargando…</p>
          ) : replies.length === 0 ? (
            <p className="text-sm text-texto-suave">Aún no hay respuestas rápidas. Créalas en Configuración → Respuestas rápidas.</p>
          ) : (
            <ul className="space-y-3">
              {replies.map((r) => {
                const allowed = r.agent_permission !== "human_only";
                return (
                  <li key={r.id} className="space-y-2 rounded-xl border p-3">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-semibold">/{r.shortcut}</code>
                      <Switch
                        className="ml-auto"
                        checked={allowed}
                        onCheckedChange={(on) => patchReply(r.id, { agent_permission: on ? "approval" : "human_only" })}
                        aria-label={`Permitir /${r.shortcut} al asistente`}
                      />
                    </div>
                    <p className="line-clamp-2 text-xs text-texto-suave">{r.body}</p>
                    {allowed && (
                      <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
                        <Input
                          value={r.when_to_use ?? ""}
                          onChange={(e) => patchReply(r.id, { when_to_use: e.target.value })}
                          maxLength={300}
                          placeholder="Cuándo usarla"
                          aria-label={`Cuándo usar /${r.shortcut}`}
                        />
                        <Select
                          value={r.agent_permission}
                          onValueChange={(v) => isQuickReplyPermission(v) && patchReply(r.id, { agent_permission: v })}
                        >
                          <SelectTrigger className="w-full" aria-label={`Permiso de /${r.shortcut}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectItem value="automatic">{QUICK_REPLY_PERMISSION_LABELS.automatic}</SelectItem>
                            <SelectItem value="approval">{QUICK_REPLY_PERMISSION_LABELS.approval}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ConfigSection>

        <ConfigSection title="Escalamiento" description="Cuándo y a quién transfiere.">
          <div className="space-y-1.5">
            <Label htmlFor="ag-topics">Temas que siempre pasan a una persona</Label>
            <Input id="ag-topics" value={topicsText} onChange={(e) => setTopicsText(e.target.value)} placeholder="queja, factura, garantía" />
            <p className="text-xs text-texto-suave">Separados por comas. Se detectan sin acentos ni mayúsculas.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-handoff">Mensaje de traspaso</Label>
            <Textarea
              id="ag-handoff"
              value={config.escalation.handoff_message}
              onChange={(e) => patch("escalation", { handoff_message: e.target.value })}
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-assign">Asignar a</Label>
            <Select
              value={config.escalation.assign_to ?? NO_ASSIGNEE}
              onValueChange={(v) => patch("escalation", { assign_to: v === NO_ASSIGNEE ? null : v })}
            >
              <SelectTrigger id="ag-assign" className="w-full">
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

        <ConfigSection title="Instrucciones adicionales" description="Siempre por debajo de las reglas del proveedor.">
          <Textarea
            value={config.extra_instructions}
            onChange={(e) => patch("extra_instructions", e.target.value)}
            rows={5}
            maxLength={limits.extra_instructions_max}
            placeholder="Ej.: Si preguntan por envíos a otra ciudad, pide el código postal."
            aria-label="Instrucciones adicionales"
          />
          <p className={cn("text-right text-xs", instructionsLeft < 50 ? "text-advertencia-texto" : "text-texto-suave")}>
            {config.extra_instructions.length} / {limits.extra_instructions_max}
          </p>
        </ConfigSection>

        <ConfigSection title="Alertas" description="Avisos para los administradores en esta página.">
          {(
            [
              ["on_handoff", "Cuando transfiere a una persona"],
              ["on_daily_cap", "Cuando llega al tope diario"],
              ["on_error", "Cuando falla al generar respuestas"],
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
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ChoiceSelect<T extends string>({
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
  const id = `ag-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {(Object.keys(options) as T[]).map((k) => (
            <SelectItem key={k} value={k}>
              {options[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Campo numérico acotado: recorta al salir del campo (la base vuelve a recortar). */
function NumberField({
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
        onChange={(e) => setText(e.target.value)}
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
