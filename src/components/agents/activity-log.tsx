"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/crm/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchActivity, type AgentUsageRow } from "@/lib/agents/client";
import { OUTCOME_LABELS } from "@/lib/agents/config";
import { formatDateTime, formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { BotIcon } from "lucide-react";

const OUTCOME_TONES: Record<string, string> = {
  sent: "bg-exito-suave text-exito-texto",
  suggested: "bg-marca-suave text-marca-texto",
  handoff: "bg-advertencia-suave text-advertencia-texto",
  error: "bg-error-suave text-error-texto",
  blocked_by_limit: "bg-error-suave text-error-texto",
  skipped: "bg-superficie-3 text-texto-suave",
};

const numberFmt = new Intl.NumberFormat("es-MX");
const usdFmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

type Props = {
  agentIds: string[];
  /** Nombre de cada agente: con más de uno se muestra la columna «Agente». */
  agentNames: Map<string, string>;
  refreshKey: number;
};

/**
 * Registro de lo que hicieron los agentes (solo admin; la RLS lo limita).
 * Se muestra dentro del panel lateral «Registro de actividad».
 */
export function ActivityLog({ agentIds, agentNames, refreshKey }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<AgentUsageRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const idsKey = agentIds.join(",");
  const showAgent = agentIds.length > 1;

  useEffect(() => {
    let cancelled = false;
    fetchActivity(supabase, idsKey ? idsKey.split(",") : [])
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, idsKey, refreshKey]);

  return (
    <div>
      {failed ? (
        <p className="px-5 py-6 text-sm text-error-texto">No se pudo cargar el registro.</p>
      ) : rows === null ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={BotIcon} title="Sin actividad todavía" description="Aquí verás cada respuesta, sugerencia o transferencia del asistente." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Fecha</TableHead>
              {showAgent && <TableHead>Agente</TableHead>}
              <TableHead>Contacto</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="hidden md:table-cell">Motivo</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Tokens</TableHead>
              <TableHead className="hidden pr-5 text-right lg:table-cell">Costo est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const contact = row.conversation?.contacts;
              const name = contact?.name?.trim() || (contact ? formatPhone(contact.wa_id ?? contact.phone) : "—");
              return (
                <TableRow key={row.id}>
                  <TableCell className="pl-5 text-xs whitespace-nowrap text-texto-suave">{formatDateTime(row.created_at)}</TableCell>
                  {showAgent && <TableCell className="whitespace-nowrap">{agentNames.get(row.agent_id) ?? "—"}</TableCell>}
                  <TableCell className="max-w-40 truncate">
                    {row.conversation ? (
                      <Link href={`/?c=${row.conversation.id}`} className="hover:underline">
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", OUTCOME_TONES[row.outcome])}>
                      {OUTCOME_LABELS[row.outcome] ?? row.outcome}
                    </span>
                  </TableCell>
                  <TableCell className="hidden max-w-72 truncate text-texto-suave md:table-cell" title={row.reason ?? undefined}>
                    {row.reason ?? "—"}
                    {row.handled_messages > 1 && <span className="text-xs"> · atendió {row.handled_messages} mensajes</span>}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {numberFmt.format(row.input_tokens + row.output_tokens)}
                  </TableCell>
                  <TableCell className="hidden pr-5 text-right tabular-nums lg:table-cell">{usdFmt.format(Number(row.est_cost_usd))}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
