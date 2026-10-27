"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { PencilIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetchContactSummary, saveContactSummary, type ContactSummaryRow } from "@/lib/agents/client";
import { parseCounters } from "@/lib/agents/notes-plan";
import { errorMessage } from "@/lib/crm/contacts";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useAgentNames } from "./use-agent-names";

/**
 * «Resumen del cliente», fijo arriba de las notas internas. Lo mantiene el
 * Asistente de notas; cualquier persona con acceso al chat lo puede corregir
 * y el agente parte de esa versión en su siguiente pasada.
 */
export function ContactSummaryCard({ contactId }: { contactId: string }) {
  const supabase = createClient();
  const { profiles } = useCrm();
  const agentName = useAgentNames();
  const [row, setRow] = useState<ContactSummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    const load = () =>
      fetchContactSummary(supabase, contactId).then(
        (data) => {
          if (cancelled) return;
          setRow(data);
          setLoading(false);
        },
        () => {
          if (!cancelled) setLoading(false);
        },
      );
    void load();
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      // El agente actualiza el resumen mientras el chat está abierto.
      channel = supabase
        .channel(`summary:${contactId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "contact_summaries", filter: `contact_id=eq.${contactId}` }, () => void load())
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, contactId]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await saveContactSummary(supabase, contactId, draft);
      setRow(saved);
      setEditing(false);
      if (saved.summary.length < draft.trim().length) toast.success("Resumen guardado (se recortó al largo máximo)");
      else toast.success("Resumen guardado");
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo guardar el resumen"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-16 rounded-lg" />;

  const summary = row?.summary.trim() ?? "";
  const counters = parseCounters(row?.counters);
  // Quién lo tocó al último: una persona o el agente.
  const editedByPerson = Boolean(row?.edited_by_user_at && (!row.updated_by_agent_at || row.edited_by_user_at > row.updated_by_agent_at));
  const byline = !row
    ? null
    : editedByPerson
      ? `Editado por ${profileName(profiles.find((p) => p.id === row.edited_by))} · ${formatDateTime(row.edited_by_user_at!)}`
      : row.updated_by_agent_at
        ? `Actualizado por ${agentName(row.agent_id)} · ${formatDateTime(row.updated_by_agent_at)}`
        : null;

  return (
    <section aria-label="Resumen del cliente" className="rounded-lg border bg-card p-3 text-sm shadow-xs">
      <header className="mb-1.5 flex items-center gap-2">
        <SparklesIcon className="size-3.5 text-marca-texto" aria-hidden />
        <h3 className="flex-1 text-xs font-semibold tracking-wide text-texto-suave uppercase">Resumen del cliente</h3>
        {!editing && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              setDraft(row?.summary ?? "");
              setEditing(true);
            }}
            aria-label="Editar resumen"
          >
            <PencilIcon />
          </Button>
        )}
      </header>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void save();
              }
              if (e.key === "Escape") setEditing(false);
            }}
            rows={4}
            autoFocus
            className="max-h-60 resize-y bg-background"
            aria-label="Resumen del cliente"
            placeholder="Productos de interés, entrega, solicitudes y en qué punto va."
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className={summary ? "break-words whitespace-pre-wrap" : "text-texto-suave"}>
            {summary || "Todavía no hay resumen de este cliente."}
          </p>
          {counters.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Productos y medidas de interés">
              {counters.map((c) => (
                <li key={c.item} className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs">
                  {c.item} <span className="text-texto-suave tabular-nums">×{c.count}</span>
                </li>
              ))}
            </ul>
          )}
          {byline && <p className="mt-1.5 text-xs text-texto-suave">{byline}</p>}
        </>
      )}
    </section>
  );
}
