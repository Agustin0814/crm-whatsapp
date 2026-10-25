"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClassificationBadge, CLASSIFICATION_STYLES } from "@/components/crm/classification-badge";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  /** Se llama tras guardar para recargar la ficha (la base fija origen y fecha). */
  onChanged: () => void | Promise<void>;
};

/**
 * Clasificación de una persona o empresa: insignia, origen del último cambio,
 * cambio manual con motivo opcional e historial (solo lectura).
 */
export function ClassificationControl({ entity, id, classification, source, classifiedAt, inactive, onChanged }: Props) {
  const supabase = createClient();
  const { profiles } = useCrm();
  const current: Classification = isClassification(classification) ? classification : "unclassified";
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Classification>(current);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ClassificationHistoryEntry[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  function openDialog() {
    setChoice(current);
    setReason("");
    setOpen(true);
  }

  async function save() {
    if (choice === current) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await setClassification(supabase, entity, id, choice, reason);
      toast.success(`Clasificado como ${CLASSIFICATION_LABELS[choice]}`);
      setOpen(false);
      setHistory(null);
      setShowHistory(false);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo cambiar la clasificación"));
    } finally {
      setSaving(false);
    }
  }

  function toggleHistory() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    if (history) return;
    setLoadingHistory(true);
    fetchClassificationHistory(supabase, entity, id)
      .then(setHistory)
      .catch((error) => toast.error(errorMessage(error, "No se pudo cargar el historial")))
      .finally(() => setLoadingHistory(false));
  }

  const who = (userId: string | null) =>
    userId ? profileName(profiles.find((p) => p.id === userId)) : "Sistema";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ClassificationBadge classification={current} inactive={inactive} />
        <span className="text-xs text-texto-suave">
          {CLASSIFICATION_SOURCE_LABELS[source] ?? source}
          {classifiedAt && ` · ${formatDate(classifiedAt)}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={openDialog}>
          Cambiar clasificación
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleHistory} aria-expanded={showHistory}>
          {showHistory ? "Ocultar historial" : "Ver historial"}
        </Button>
      </div>

      {showHistory && (
        <ol className="space-y-2 rounded-xl bg-superficie-2 p-3 text-sm" aria-label="Historial de clasificación">
          {loadingHistory && <li className="text-texto-suave">Cargando…</li>}
          {history?.length === 0 && <li className="text-texto-suave">Sin cambios registrados.</li>}
          {history?.map((entry) => (
            <li key={entry.id} className="space-y-0.5">
              <p>
                <span className="font-medium">
                  {entry.from_classification && isClassification(entry.from_classification)
                    ? `${CLASSIFICATION_LABELS[entry.from_classification]} → `
                    : ""}
                  {isClassification(entry.to_classification)
                    ? CLASSIFICATION_LABELS[entry.to_classification]
                    : entry.to_classification}
                </span>{" "}
                <span className="text-texto-suave">
                  ({CLASSIFICATION_SOURCE_LABELS[entry.source] ?? entry.source})
                </span>
              </p>
              <p className="text-xs text-texto-suave">
                {formatDateTime(entry.changed_at)} · {who(entry.changed_by)}
              </p>
              {entry.reason && <p className="text-xs">{entry.reason}</p>}
            </li>
          ))}
        </ol>
      )}

      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar clasificación</DialogTitle>
            <DialogDescription>
              El cambio queda en el historial con tu nombre. «Cliente» también se asigna solo al confirmar un pedido.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Clasificación" className="grid grid-cols-2 gap-2">
            {CLASSIFICATIONS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={choice === c}
                onClick={() => setChoice(c)}
                className={cn(
                  "flex h-11 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                  choice === c ? cn("border-transparent ring-2 ring-marca", CLASSIFICATION_STYLES[c]) : "hover:bg-superficie-2",
                )}
              >
                {CLASSIFICATION_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`motivo-${id}`}>Motivo (opcional)</Label>
            <Textarea
              id={`motivo-${id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="Ej.: pidió cotización por teléfono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving || choice === current}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
