"use client";

import { HistoryIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CLASSIFICATION_STYLES } from "@/components/crm/classification-badge";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchClassificationHistory, setClassification } from "@/lib/crm/classification";
import { errorMessage } from "@/lib/crm/contacts";
import {
  CLASSIFICATION_LABELS,
  CLASSIFICATION_SOURCE_LABELS,
  CLASSIFICATIONS,
  isClassification,
  type Classification,
  type ClassificationEntity,
  type ClassificationHistoryEntry,
} from "@/lib/crm/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  entity: ClassificationEntity;
  id: string;
  classification: string;
  source: string;
  classifiedAt: string | null;
  inactive?: boolean;
  /** Tras guardar (la base fija origen y fecha). */
  onChanged: () => void | Promise<void>;
};

/**
 * Clasificación en UNA línea: selector compacto (cambiar = un clic y elegir),
 * origen y fecha en texto pequeño, e historial detrás de un icono. El cambio
 * queda en el historial con el usuario (`set_classification`).
 */
export function ClassificationControl({ entity, id, classification, source, classifiedAt, inactive, onChanged }: Props) {
  const supabase = createClient();
  const { profiles } = useCrm();
  const current: Classification = isClassification(classification) ? classification : "unclassified";
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ClassificationHistoryEntry[] | null>(null);

  async function change(value: string) {
    if (!isClassification(value) || value === current) return;
    setSaving(true);
    try {
      await setClassification(supabase, entity, id, value, "");
      toast.success(`Clasificado como ${CLASSIFICATION_LABELS[value]}`);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo cambiar la clasificación"));
    } finally {
      setSaving(false);
    }
  }

  function loadHistory(open: boolean) {
    if (!open) return;
    fetchClassificationHistory(supabase, entity, id)
      .then(setHistory)
      .catch((error) => toast.error(errorMessage(error, "No se pudo cargar el historial")));
  }

  const who = (userId: string | null) => (userId ? profileName(profiles.find((p) => p.id === userId)) : "Sistema");
  const origin = `${CLASSIFICATION_SOURCE_LABELS[source] ?? source}${classifiedAt ? ` · ${formatDate(classifiedAt)}` : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={current} onValueChange={(v) => void change(v)} disabled={saving}>
        <SelectTrigger
          size="sm"
          className={cn("h-8 w-auto gap-1.5 rounded-full border-transparent px-3 text-xs font-medium", CLASSIFICATION_STYLES[current])}
          aria-label="Clasificación"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {CLASSIFICATIONS.map((c) => (
            <SelectItem key={c} value={c}>
              {CLASSIFICATION_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {inactive && (
        <span className="inline-flex h-6 items-center rounded-full bg-error-suave px-2.5 text-xs font-medium text-error-texto">
          Inactivo
        </span>
      )}
      <span className="min-w-0 truncate text-xs text-texto-suave">{origin}</span>

      <Popover onOpenChange={loadHistory}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="ml-auto rounded-md p-1 text-texto-suave hover:bg-superficie-2 hover:text-texto"
                aria-label="Historial de clasificación"
              >
                <HistoryIcon className="size-4" aria-hidden />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Historial de clasificación</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="max-h-80 w-72 overflow-y-auto">
          {history === null && <p className="text-sm text-texto-suave">Cargando…</p>}
          {history?.length === 0 && <p className="text-sm text-texto-suave">Sin cambios registrados.</p>}
          {history && history.length > 0 && (
            <ol className="space-y-2 text-sm">
              {history.map((entry) => (
                <li key={entry.id}>
                  <p className="font-medium">
                    {entry.from_classification && isClassification(entry.from_classification)
                      ? `${CLASSIFICATION_LABELS[entry.from_classification]} → `
                      : ""}
                    {isClassification(entry.to_classification) ? CLASSIFICATION_LABELS[entry.to_classification] : entry.to_classification}
                  </p>
                  <p className="text-xs text-texto-suave">
                    {CLASSIFICATION_SOURCE_LABELS[entry.source] ?? entry.source} · {formatDateTime(entry.changed_at)} ·{" "}
                    {who(entry.changed_by)}
                  </p>
                  {entry.reason && <p className="text-xs">{entry.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
