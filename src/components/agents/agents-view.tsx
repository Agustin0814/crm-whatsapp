"use client";

import { BellIcon, BotIcon, FlaskConicalIcon, NotebookPenIcon, Settings2Icon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { PageHeader } from "@/components/crm/page-header";
import { AgentsSkeleton } from "@/components/crm/section-skeletons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  fetchAgentLimits,
  fetchAgents,
  fetchAlerts,
  fetchMonthlyUsage,
  markAlertsRead,
  saveAgentSettings,
  type Agent,
  type AgentAlert,
  type MonthlyUsage,
} from "@/lib/agents/client";
import {
  AGENT_DESCRIPTIONS,
  AGENT_MODE_LABELS,
  DEFAULT_AGENT_DESCRIPTION,
  DEFAULT_LIMITS,
  type AgentKind,
  type AgentLimits,
  type AgentMode,
} from "@/lib/agents/config";
import { errorMessage } from "@/lib/crm/contacts";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ActivityLog } from "./activity-log";
import { AgentConfigForm } from "./agent-config-form";
import { LockedConfigForm } from "./locked-config-form";
import { notifyAssistantChanged } from "@/components/assistant/assistant-provider";
import { NotesConfigForm } from "./notes-config-form";
import { SystemConfigForm } from "./system-config-form";

const numberFmt = new Intl.NumberFormat("es-MX");
const usdFmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const EMPTY_USAGE: MonthlyUsage = { replies: 0, notePasses: 0, notesCreated: 0, tokens: 0, costUsd: 0 };

function agentMode(agent: Agent): AgentMode {
  return agent.mode === "automatic" ? "automatic" : "suggestion";
}

/** El Asistente de notas no habla con el cliente: no tiene modo Sugerencia/Automático. */
function isNotesAgent(agent: Agent): boolean {
  return agent.kind === "notes";
}

/** El Asistente del sistema habla con el equipo, no con clientes: tampoco tiene modo. */
function isSystemAgent(agent: Agent): boolean {
  return agent.kind === "system";
}

function agentKind(agent: Agent): AgentKind {
  return agent.kind === "notes" || agent.kind === "system" ? agent.kind : "responder";
}

/**
 * Sección «Agentes»: uso del mes de TODOS los agentes, alertas y la lista de
 * agentes (encendido, modo y «Configurar»). La configuración y el registro de
 * actividad se abren en paneles laterales. Toda regla se vuelve a aplicar en
 * el servidor; aquí solo se piden cambios.
 */
export function AgentsView() {
  const supabase = createClient();
  const { isAdmin, isSuperadmin, loading: crmLoading } = useCrm();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [limitsById, setLimitsById] = useState<Record<string, AgentLimits>>({});
  const [usage, setUsage] = useState<MonthlyUsage>(EMPTY_USAGE);
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  // El agente del panel se conserva al cerrar para que la animación de salida no quede vacía.
  const [configId, setConfigId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  // Cambios sin guardar de cada pestaña del panel (cliente y proveedor).
  const [dirty, setDirty] = useState({ config: false, locked: false });
  const [confirmClose, setConfirmClose] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchAgents(supabase);
    const [limits, monthly, alertList] = await Promise.all([
      Promise.all(list.map((a) => fetchAgentLimits(supabase, a.key).then((l) => [a.id, l] as const))),
      isAdmin ? fetchMonthlyUsage(supabase) : Promise.resolve(EMPTY_USAGE),
      isAdmin ? fetchAlerts(supabase) : Promise.resolve([]),
    ]);
    return { list, limits: Object.fromEntries(limits), monthly, alertList };
  }, [supabase, isAdmin]);

  useEffect(() => {
    if (crmLoading) return;
    let cancelled = false;
    load()
      .then(({ list, limits, monthly, alertList }) => {
        if (cancelled) return;
        setAgents(list);
        setLimitsById(limits);
        setUsage(monthly);
        setAlerts(alertList);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [load, crmLoading, reloadKey]);

  function replaceAgent(saved: Agent) {
    setAgents((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
  }

  async function update(agent: Agent, changes: { enabled?: boolean; mode?: AgentMode }) {
    replaceAgent({ ...agent, ...changes }); // optimista
    setBusyIds((prev) => [...prev, agent.id]);
    try {
      replaceAgent(await saveAgentSettings(supabase, agent.key, changes));
      if (isSystemAgent(agent)) notifyAssistantChanged();
      if (changes.enabled !== undefined) toast.success(`${agent.name}: ${changes.enabled ? "activo" : "inactivo"}`);
    } catch (error) {
      replaceAgent(agent);
      toast.error(errorMessage(error, "No se pudo cambiar el agente"));
    } finally {
      setBusyIds((prev) => prev.filter((id) => id !== agent.id));
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

  /** Cerrar el panel con cambios sin guardar pide confirmación (nunca se pierden en silencio). */
  function handleConfigOpenChange(open: boolean) {
    if (!open && (dirty.config || dirty.locked)) {
      setConfirmClose(true);
      return;
    }
    setConfigOpen(open);
  }

  function discardAndClose() {
    setConfirmClose(false);
    setDirty({ config: false, locked: false });
    setConfigOpen(false);
  }

  function openConfig(agent: Agent) {
    setDirty({ config: false, locked: false });
    setConfigId(agent.id);
    setConfigOpen(true);
  }

  const header = (
    <PageHeader
      title="Agentes"
      actions={
        isAdmin && (
          <Button variant="outline" onClick={() => setActivityOpen(true)} disabled={status !== "ready" || agents.length === 0}>
            <Icon name="reloj" /> Registro de actividad
          </Button>
        )
      }
    />
  );

  if (status === "loading") return <AgentsSkeleton />;
  if (status === "error") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            tone="error"
            icon={BotIcon}
            title="No se pudieron cargar los agentes"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={
              <Button
                onClick={() => {
                  setStatus("loading");
                  setReloadKey((k) => k + 1);
                }}
              >
                Reintentar
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const unreadAlerts = alerts.filter((a) => !a.read_at);
  const agentNames = new Map(agents.map((a) => [a.id, a.name]));
  // Tope mensual total: suma de los topes de cada agente (capa bloqueada).
  const tokenCap = agents.reduce((sum, a) => sum + (limitsById[a.id]?.monthly_token_cap ?? 0), 0);
  const tokenPct = tokenCap > 0 ? Math.min(100, Math.round((usage.tokens / tokenCap) * 100)) : 0;
  const configAgent = agents.find((a) => a.id === configId) ?? null;
  const hasNotesAgent = agents.some(isNotesAgent);

  const rowProps = (agent: Agent) => ({
    agent,
    limits: limitsById[agent.id] ?? DEFAULT_LIMITS,
    canEdit: isAdmin,
    busy: busyIds.includes(agent.id),
    onUpdate: (changes: { enabled?: boolean; mode?: AgentMode }) => void update(agent, changes),
    onConfigure: () => openConfig(agent),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
          {/* Uso del mes de todos los agentes */}
          {isAdmin && (
            <section className="grid gap-3 sm:grid-cols-3" aria-label="Uso del mes">
              <Stat
                label="Respuestas del mes"
                value={numberFmt.format(usage.replies)}
                hint={hasNotesAgent ? `${numberFmt.format(usage.notesCreated)} notas en ${numberFmt.format(usage.notePasses)} pasadas` : undefined}
              />
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-texto-suave">Tokens del mes</p>
                <p className="text-xl font-semibold tabular-nums">
                  {numberFmt.format(usage.tokens)}
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
              <Stat label="Costo estimado del mes" value={usdFmt.format(usage.costUsd)} />
            </section>
          )}

          {/* Alertas */}
          {isAdmin && unreadAlerts.length > 0 && (
            <section className="rounded-2xl border border-advertencia/40 bg-advertencia-suave p-4 text-advertencia-texto" aria-label="Alertas">
              <div className="mb-2 flex items-center gap-2">
                <BellIcon className="size-4" aria-hidden />
                <h2 className="flex-1 text-sm font-semibold">Alertas de los agentes</h2>
                <Button size="sm" variant="ghost" onClick={() => void dismissAlerts()}>
                  Marcar como leídas
                </Button>
              </div>
              <ul className="space-y-1 text-sm">
                {unreadAlerts.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <span className="text-xs opacity-80">{formatDateTime(a.created_at)}</span>
                    {agents.length > 1 && <span className="font-medium"> · {agentNames.get(a.agent_id) ?? "Agente"}</span>} ·{" "}
                    {a.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Lista de agentes */}
          {agents.length === 0 ? (
            <EmptyState icon={BotIcon} title="Aún no hay agentes" description="Cuando el superadmin active un agente, aparecerá aquí." />
          ) : (
            <section aria-label="Agentes">
              {/* ≥ 768 px: tabla */}
              <div className="hidden rounded-2xl border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Agente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead className="pr-4 text-right">
                        <span className="sr-only">Acción</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => {
                      const p = rowProps(agent);
                      return (
                        <TableRow key={agent.id}>
                          <TableCell className="py-3 pl-4 whitespace-normal">
                            <AgentIdentity agent={agent} />
                          </TableCell>
                          <TableCell>
                            <StatusControl {...p} />
                          </TableCell>
                          <TableCell>
                            <ModeControl {...p} />
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <ConfigureButton {...p} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* < 768 px: tarjetas apiladas con los mismos controles */}
              <ul className="space-y-3 md:hidden">
                {agents.map((agent) => {
                  const p = rowProps(agent);
                  return (
                    <li key={agent.id} className="space-y-4 rounded-2xl border bg-card p-4">
                      <AgentIdentity agent={agent} />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-texto-suave">Estado</span>
                        <StatusControl {...p} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-texto-suave">Modo</span>
                        <ModeControl {...p} />
                      </div>
                      <ConfigureButton {...p} className="w-full" />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* Panel de configuración del agente elegido */}
      <Sheet open={configOpen} onOpenChange={handleConfigOpenChange}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="text-lg">{configAgent ? `Configurar ${configAgent.name}` : "Configurar agente"}</SheetTitle>
            <SheetDescription>
              {isAdmin ? "Los límites se recortan a lo que permite tu plan." : "Solo un administrador puede cambiar la configuración."}
            </SheetDescription>
          </SheetHeader>
          {configAgent && (
            <Tabs key={configAgent.id} defaultValue="config" className="flex min-h-0 flex-1 flex-col gap-0">
              <TabsList variant="line" className="w-full justify-start border-b px-5">
                <TabsTrigger value="config" className="flex-none">
                  Configuración
                  {dirty.config && <UnsavedDot />}
                </TabsTrigger>
                {isSuperadmin && (
                  <TabsTrigger value="locked" className="flex-none">
                    Superadmin
                    {dirty.locked && <UnsavedDot />}
                  </TabsTrigger>
                )}
                <TabsTrigger value="tester" className="flex-none" disabled>
                  <FlaskConicalIcon aria-hidden /> Probador
                  <Badge variant="secondary" className="ml-1">
                    Próximamente
                  </Badge>
                </TabsTrigger>
              </TabsList>
              {/* forceMount: las dos pestañas siguen montadas al cambiar entre ellas, así
                  lo que se editó en una NO se pierde al ir a la otra (antes Radix las
                  desmontaba y los cambios sin guardar desaparecían sin aviso). */}
              <TabsContent forceMount value="config" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                {isSystemAgent(configAgent) ? (
                  <SystemConfigForm
                    key={configAgent.updated_at}
                    agent={configAgent}
                    limits={limitsById[configAgent.id] ?? DEFAULT_LIMITS}
                    canEdit={isAdmin}
                    onDirtyChange={(d) => setDirty((prev) => (prev.config === d ? prev : { ...prev, config: d }))}
                    onSaved={(saved) => {
                      replaceAgent(saved);
                      setReloadKey((k) => k + 1);
                      notifyAssistantChanged();
                    }}
                  />
                ) : isNotesAgent(configAgent) ? (
                  <NotesConfigForm
                    key={configAgent.updated_at}
                    agent={configAgent}
                    limits={limitsById[configAgent.id] ?? DEFAULT_LIMITS}
                    canEdit={isAdmin}
                    onDirtyChange={(d) => setDirty((prev) => (prev.config === d ? prev : { ...prev, config: d }))}
                    onSaved={(saved) => {
                      replaceAgent(saved);
                      setReloadKey((k) => k + 1);
                    }}
                  />
                ) : (
                  <AgentConfigForm
                    key={configAgent.updated_at}
                    agent={configAgent}
                    limits={limitsById[configAgent.id] ?? DEFAULT_LIMITS}
                    canEdit={isAdmin}
                    onDirtyChange={(d) => setDirty((prev) => (prev.config === d ? prev : { ...prev, config: d }))}
                    onSaved={(saved) => {
                      replaceAgent(saved);
                      setReloadKey((k) => k + 1);
                    }}
                  />
                )}
              </TabsContent>
              {isSuperadmin && (
                <TabsContent forceMount value="locked" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                  <LockedConfigForm
                    agentId={configAgent.id}
                    agentKey={configAgent.key}
                    kind={agentKind(configAgent)}
                    onDirtyChange={(d) => setDirty((prev) => (prev.locked === d ? prev : { ...prev, locked: d }))}
                    onSaved={() => setReloadKey((k) => k + 1)}
                  />
                </TabsContent>
              )}
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              {dirty.config && dirty.locked
                ? "Hay cambios sin guardar en «Configuración» y en «Superadmin»."
                : dirty.locked
                  ? "Hay cambios sin guardar en «Superadmin»."
                  : "Hay cambios sin guardar en «Configuración»."}{" "}
              Cada pestaña se guarda con su propio botón «Guardar».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discardAndClose}>
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Registro de actividad (todos los agentes) */}
      {isAdmin && (
        <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
          <SheetContent side="right" className="w-full gap-0 sm:max-w-3xl">
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="text-lg">Registro de actividad</SheetTitle>
              <SheetDescription>Últimas respuestas, sugerencias, transferencias y notas de los agentes.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activityOpen && <ActivityLog agentIds={agents.map((a) => a.id)} agentNames={agentNames} refreshKey={reloadKey} />}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

// --- Piezas de la lista (tabla y tarjetas usan las mismas) ---------------------------

type RowProps = {
  agent: Agent;
  limits: AgentLimits;
  canEdit: boolean;
  busy: boolean;
  onUpdate: (changes: { enabled?: boolean; mode?: AgentMode }) => void;
  onConfigure: () => void;
};

function AgentIdentity({ agent }: { agent: Agent }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-marca-suave text-marca-texto">
        {isSystemAgent(agent) ? (
          <SparklesIcon className="size-5" aria-hidden />
        ) : isNotesAgent(agent) ? (
          <NotebookPenIcon className="size-5" aria-hidden />
        ) : (
          <BotIcon className="size-5" aria-hidden />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-medium">{agent.name}</p>
        <p className="text-xs text-texto-suave">{AGENT_DESCRIPTIONS[agent.key] ?? DEFAULT_AGENT_DESCRIPTION}</p>
      </div>
    </div>
  );
}

/** Interruptor Activo / Inactivo; con kill switch, deshabilitado y con aviso. */
function StatusControl({ agent, limits, canEdit, busy, onUpdate }: RowProps) {
  const stopped = limits.kill_switch;
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <Switch
        checked={agent.enabled && !stopped}
        onCheckedChange={(on) => onUpdate({ enabled: on })}
        disabled={!canEdit || busy || stopped}
        aria-label={`Activar o desactivar ${agent.name}`}
      />
      {stopped ? (
        <span className="rounded-full bg-error-suave px-2 py-0.5 text-xs text-error-texto">Detenido por el superadmin</span>
      ) : (
        <span className={agent.enabled ? "text-exito-texto" : "text-texto-suave"}>{agent.enabled ? "Activo" : "Inactivo"}</span>
      )}
    </label>
  );
}

function ModeControl({ agent, canEdit, busy, onUpdate }: RowProps) {
  if (isNotesAgent(agent)) {
    return <span className="text-sm text-texto-suave">Solo notas internas</span>;
  }
  if (isSystemAgent(agent)) {
    return <span className="text-sm text-texto-suave">Solo para tu equipo</span>;
  }
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={agentMode(agent)}
      onValueChange={(v) => v && onUpdate({ mode: v as AgentMode })}
      disabled={!canEdit || busy}
      aria-label={`Modo de ${agent.name}`}
    >
      <ToggleGroupItem value="suggestion">{AGENT_MODE_LABELS.suggestion}</ToggleGroupItem>
      <ToggleGroupItem value="automatic">{AGENT_MODE_LABELS.automatic}</ToggleGroupItem>
    </ToggleGroup>
  );
}

function ConfigureButton({ agent, onConfigure, className }: RowProps & { className?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onConfigure} className={className} aria-label={`Configurar ${agent.name}`}>
      <Settings2Icon aria-hidden /> Configurar
    </Button>
  );
}

/** Punto de «cambios sin guardar» en la pestaña del panel. */
function UnsavedDot() {
  return (
    <>
      <span className="size-1.5 rounded-full bg-marca" aria-hidden />
      <span className="sr-only">(cambios sin guardar)</span>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-texto-suave">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-texto-suave tabular-nums">{hint}</p>}
    </div>
  );
}
