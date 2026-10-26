"use client";

import { BellIcon, BotIcon, FlaskConicalIcon, Settings2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { PageHeader } from "@/components/crm/page-header";
import { AgentsSkeleton } from "@/components/crm/section-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  fetchAgent,
  fetchAgentLimits,
  fetchAlerts,
  fetchUsageSummary,
  markAlertsRead,
  saveAgentSettings,
  type Agent,
  type AgentAlert,
  type AgentUsageSummary,
} from "@/lib/agents/client";
import { AGENT_KEYS, AGENTS_DESCRIPTION, AGENT_MODE_LABELS, DEFAULT_LIMITS, type AgentLimits, type AgentMode } from "@/lib/agents/config";
import { errorMessage } from "@/lib/crm/contacts";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ActivityLog } from "./activity-log";
import { AgentConfigForm } from "./agent-config-form";
import { LockedConfigForm } from "./locked-config-form";

const KEY = AGENT_KEYS.responder;

const numberFmt = new Intl.NumberFormat("es-MX");
const usdFmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/**
 * Sección «Agentes»: tarjeta del Asistente de respuestas (encendido, modo,
 * estado y uso), panel lateral de configuración, alertas y registro de
 * actividad. Toda regla se vuelve a aplicar en el servidor.
 */
export function AgentsView() {
  const supabase = createClient();
  const { isAdmin, isSuperadmin, loading: crmLoading } = useCrm();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [limits, setLimits] = useState<AgentLimits>(DEFAULT_LIMITS);
  const [usage, setUsage] = useState<AgentUsageSummary | null>(null);
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    const a = await fetchAgent(supabase, KEY);
    if (!a) throw new Error("Agente no encontrado");
    const [l, u, al] = await Promise.all([
      fetchAgentLimits(supabase, KEY),
      fetchUsageSummary(supabase, KEY),
      isAdmin ? fetchAlerts(supabase, a.id) : Promise.resolve([]),
    ]);
    return { a, l, u, al };
  }, [supabase, isAdmin]);

  useEffect(() => {
    if (crmLoading) return;
    let cancelled = false;
    load()
      .then(({ a, l, u, al }) => {
        if (cancelled) return;
        setAgent(a);
        setLimits(l);
        setUsage(u);
        setAlerts(al);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [load, crmLoading, reloadKey]);

  async function update(changes: { enabled?: boolean; mode?: AgentMode }) {
    if (!agent) return;
    const previous = agent;
    setAgent({ ...agent, ...changes }); // optimista
    setBusy(true);
    try {
      setAgent(await saveAgentSettings(supabase, KEY, changes));
      if (changes.enabled !== undefined) toast.success(changes.enabled ? "Asistente encendido" : "Asistente apagado");
    } catch (error) {
      setAgent(previous);
      toast.error(errorMessage(error, "No se pudo cambiar el asistente"));
    } finally {
      setBusy(false);
    }
  }

  async function dismissAlerts() {
    const unread = alerts.filter((a) => !a.read_at).map((a) => a.id);
    try {
      await markAlertsRead(supabase, unread);
      const now = new Date().toISOString();
      setAlerts((prev) => prev.map((a) => (a.read_at ? a : { ...a, read_at: now })));
    } catch {
      toast.error("No se pudieron marcar las alertas");
    }
  }

  const header = <PageHeader title="Agentes" description={AGENTS_DESCRIPTION} />;

  if (status === "loading") return <AgentsSkeleton />;
  if (status === "error" || !agent) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            tone="error"
            icon={BotIcon}
            title="No se pudo cargar el asistente"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={<Button onClick={() => { setStatus("loading"); setReloadKey((k) => k + 1); }}>Reintentar</Button>}
          />
        </div>
      </div>
    );
  }

  const mode: AgentMode = agent.mode === "automatic" ? "automatic" : "suggestion";
  const unreadAlerts = alerts.filter((a) => !a.read_at);
  const statusInfo = limits.kill_switch
    ? { label: "Detenido por el proveedor", tone: "bg-error-suave text-error-texto" }
    : agent.enabled
      ? { label: `Activo · ${AGENT_MODE_LABELS[mode]}`, tone: "bg-exito-suave text-exito-texto" }
      : { label: "Apagado", tone: "bg-superficie-3 text-texto-suave" };
  const tokenCap = usage?.monthly_token_cap ?? limits.monthly_token_cap;
  const tokenPct = tokenCap > 0 ? Math.min(100, Math.round(((usage?.month_tokens ?? 0) / tokenCap) * 100)) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
          {/* Tarjeta del agente */}
          <section className="rounded-2xl border bg-card p-5" aria-labelledby="agent-title">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-marca-suave text-marca-texto">
                <BotIcon className="size-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 id="agent-title" className="text-lg font-semibold">
                  {agent.name}
                </h2>
                <p className="text-sm text-texto-suave">
                  Responde mensajes de WhatsApp en el chat y puede usar tus respuestas rápidas.
                </p>
                <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusInfo.tone)}>{statusInfo.label}</span>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                {agent.enabled ? "Encendido" : "Apagado"}
                <Switch
                  checked={agent.enabled}
                  onCheckedChange={(on) => void update({ enabled: on })}
                  disabled={!isAdmin || busy}
                  aria-label="Encender o apagar el asistente"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-texto-suave">Modo</p>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={mode}
                  onValueChange={(v) => v && void update({ mode: v as AgentMode })}
                  disabled={!isAdmin || busy}
                  aria-label="Modo del asistente"
                >
                  <ToggleGroupItem value="suggestion">{AGENT_MODE_LABELS.suggestion}</ToggleGroupItem>
                  <ToggleGroupItem value="automatic">{AGENT_MODE_LABELS.automatic}</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <dl className="flex gap-6 sm:justify-center">
                <div>
                  <dt className="text-xs text-texto-suave">Respuestas hoy</dt>
                  <dd className="text-xl font-semibold tabular-nums">{numberFmt.format(usage?.today_replies ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-texto-suave">Tokens hoy</dt>
                  <dd className="text-xl font-semibold tabular-nums">{numberFmt.format(usage?.today_tokens ?? 0)}</dd>
                </div>
              </dl>
              <Button variant="outline" onClick={() => setPanelOpen(true)}>
                <Settings2Icon aria-hidden /> Configurar
              </Button>
            </div>
            <p className="mt-3 text-xs text-texto-suave">
              {mode === "suggestion"
                ? "Sugerencia: el asistente escribe un borrador en el chat y una persona lo envía, edita o descarta."
                : "Automático: el asistente envía la respuesta solo. Se pausa en un chat cuando una persona escribe o lo asigna."}
            </p>
          </section>

          {/* Resumen del mes */}
          {isAdmin && (
            <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen del mes">
              <Stat label="Respuestas del mes" value={numberFmt.format(usage?.month_replies ?? 0)} />
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-texto-suave">Tokens del mes</p>
                <p className="text-xl font-semibold tabular-nums">
                  {numberFmt.format(usage?.month_tokens ?? 0)}
                  <span className="text-sm font-normal text-texto-suave"> / {numberFmt.format(tokenCap)}</span>
                </p>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-superficie-3"
                  role="progressbar"
                  aria-valuenow={tokenPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Uso del tope mensual de tokens"
                >
                  <div className={cn("h-full rounded-full", tokenPct >= 90 ? "bg-error" : "bg-marca")} style={{ width: `${tokenPct}%` }} />
                </div>
              </div>
              <Stat label="Costo estimado del mes" value={usdFmt.format(usage?.month_cost_usd ?? 0)} />
            </section>
          )}

          {/* Alertas */}
          {isAdmin && unreadAlerts.length > 0 && (
            <section className="rounded-2xl border border-advertencia/40 bg-advertencia-suave p-4 text-advertencia-texto" aria-label="Alertas">
              <div className="mb-2 flex items-center gap-2">
                <BellIcon className="size-4" aria-hidden />
                <h2 className="flex-1 text-sm font-semibold">Alertas del asistente</h2>
                <Button size="sm" variant="ghost" onClick={() => void dismissAlerts()}>
                  Marcar como leídas
                </Button>
              </div>
              <ul className="space-y-1 text-sm">
                {unreadAlerts.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <span className="text-xs opacity-80">{formatDateTime(a.created_at)}</span> · {a.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Registro de actividad */}
          {isAdmin && <ActivityLog agentId={agent.id} refreshKey={reloadKey} />}
        </div>
      </div>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="text-lg">Configurar asistente</SheetTitle>
            <SheetDescription>
              {isAdmin ? "Los límites se recortan a lo que permite tu plan." : "Solo un administrador puede cambiar la configuración."}
            </SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="config" className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList variant="line" className="w-full justify-start border-b px-5">
              <TabsTrigger value="config" className="flex-none">Configuración</TabsTrigger>
              {isSuperadmin && <TabsTrigger value="locked" className="flex-none">Capa bloqueada</TabsTrigger>}
              <TabsTrigger value="tester" className="flex-none" disabled>
                <FlaskConicalIcon aria-hidden /> Probador
                <Badge variant="secondary" className="ml-1">Pronto</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="config" className="flex min-h-0 flex-1 flex-col">
              <AgentConfigForm
                key={agent.updated_at}
                agent={agent}
                limits={limits}
                canEdit={isAdmin}
                onSaved={(saved) => {
                  setAgent(saved);
                  setReloadKey((k) => k + 1);
                }}
              />
            </TabsContent>
            {isSuperadmin && (
              <TabsContent value="locked" className="flex min-h-0 flex-1 flex-col">
                <LockedConfigForm agentId={agent.id} onSaved={() => setReloadKey((k) => k + 1)} />
              </TabsContent>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-texto-suave">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
