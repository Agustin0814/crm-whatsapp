"use client";

import { DownloadIcon, FileSpreadsheetIcon, Loader2Icon } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import type { ImportRowResult } from "@/app/api/contacts/import/route";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  guessMapping,
  IMPORT_FIELDS,
  importTemplateCsv,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseCsv,
  splitTags,
  type ImportField,
} from "@/lib/crm/csv";
import { CLASSIFICATIONS, CLASSIFICATION_LABELS, type Classification } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

type Step = "file" | "map" | "preview" | "done";
type Mode = "skip" | "fill_empty";

const NONE = "-1";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const STATUS_LABELS: Record<ImportRowResult["status"], string> = {
  create: "Nuevo",
  duplicate: "Ya existe",
  created: "Creado",
  updated: "Actualizado",
  skipped: "Omitido",
  error: "Error",
};

const STATUS_TONE: Record<ImportRowResult["status"], string> = {
  create: "text-exito-texto",
  created: "text-exito-texto",
  updated: "text-exito-texto",
  duplicate: "text-advertencia-texto",
  skipped: "text-texto-suave",
  error: "text-error-texto",
};

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("es-MX");
  // Un teléfono guardado como número en Excel no debe salir en notación científica.
  if (typeof value === "number") return Number.isInteger(value) ? value.toFixed(0) : String(value);
  return String(value);
}

/** Lee el archivo en el navegador: el archivo nunca viaja al servidor, solo las filas. */
async function readFile(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    // Un .xlsx es un ZIP: empieza con «PK». Si no, no es lo que dice ser.
    if (head[0] !== 0x50 || head[1] !== 0x4b) throw new Error("El archivo no es un Excel (.xlsx) válido.");
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    return data.map((row) => row.map(cellText)).filter((r) => r.some((c) => c.trim() !== ""));
  }
  if (lower.endsWith(".csv")) return parseCsv(await file.text());
  throw new Error("Usa un archivo .csv o .xlsx.");
}

/**
 * Importar contactos (solo administración): archivo → asignar columnas →
 * vista previa validada en el servidor → resultado por fila. Los teléfonos
 * repetidos se omiten o solo completan campos vacíos; nunca se pisan datos.
 */
export function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>("file");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<ImportField, number>>(() => guessMapping([]));
  const [classification, setClassification] = useState<Classification>("unclassified");
  const [mode, setMode] = useState<Mode>("skip");
  const [preview, setPreview] = useState<ImportRowResult[]>([]);
  const [results, setResults] = useState<ImportRowResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep("file");
    setFilename("");
    setHeaders([]);
    setDataRows([]);
    setPreview([]);
    setResults([]);
    setError(null);
    setMode("skip");
  }

  function close() {
    reset();
    onClose();
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    const lower = file.name.toLowerCase();
    const okType =
      (lower.endsWith(".csv") && ["", "text/csv", "application/vnd.ms-excel", "text/plain"].includes(file.type)) ||
      (lower.endsWith(".xlsx") && ["", XLSX_MIME].includes(file.type));
    if (!okType) {
      setError("Usa un archivo .csv o .xlsx.");
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setError(`El archivo pesa más de ${MAX_IMPORT_BYTES / 1024 / 1024} MB. Divídelo en varios.`);
      return;
    }
    setBusy(true);
    try {
      const rows = await readFile(file);
      if (rows.length < 2) throw new Error("El archivo no tiene filas de datos (la primera fila son los encabezados).");
      if (rows.length - 1 > MAX_IMPORT_ROWS) {
        throw new Error(`El archivo tiene ${(rows.length - 1).toLocaleString("es-MX")} filas; el máximo es ${MAX_IMPORT_ROWS.toLocaleString("es-MX")}.`);
      }
      const [head, ...body] = rows;
      setFilename(file.name);
      setHeaders(head.map((h, i) => h.trim() || `Columna ${i + 1}`));
      setDataRows(body);
      setMapping(guessMapping(head));
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setBusy(false);
    }
  }

  function buildRows() {
    const cell = (row: string[], field: ImportField) => (mapping[field] >= 0 ? (row[mapping[field]] ?? "").trim() : "");
    // Número de fila como en Excel: la 1 son los encabezados.
    return dataRows.map((row, i) => ({
      row: i + 2,
      name: cell(row, "name"),
      phone: cell(row, "phone"),
      email: cell(row, "email"),
      classification: cell(row, "classification"),
      tags: splitTags(cell(row, "tags")),
      delivery_address: cell(row, "delivery_address"),
      delivery_references: cell(row, "delivery_references"),
      source: cell(row, "source"),
    }));
  }

  async function send(dryRun: boolean): Promise<ImportRowResult[] | null> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: buildRows(), mode, defaultClassification: classification, dryRun, filename }),
      });
      const data = (await response.json().catch(() => ({}))) as { results?: ImportRowResult[]; error?: string };
      if (!response.ok || !data.results) {
        setError(data.error ?? "No se pudo procesar el archivo.");
        if (data.results?.length) return data.results;
        return null;
      }
      return data.results;
    } catch {
      setError("No hay conexión con el servidor.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    if (mapping.name < 0 && mapping.phone < 0) {
      setError("Asigna al menos la columna de nombre o la de teléfono.");
      return;
    }
    const r = await send(true);
    if (r) {
      setPreview(r);
      setStep("preview");
    }
  }

  async function runImport() {
    const r = await send(false);
    if (r) {
      setResults(r);
      setStep("done");
      onImported();
      const created = r.filter((x) => x.status === "created").length;
      toast.success(`Importación terminada: ${created} contacto${created === 1 ? "" : "s"} nuevo${created === 1 ? "" : "s"}`);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([importTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-contactos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const count = (list: ImportRowResult[], s: ImportRowResult["status"]) => list.filter((r) => r.status === s).length;
  const toCreate = count(preview, "create");
  const duplicates = count(preview, "duplicate");
  const previewErrors = count(preview, "error") + count(preview, "skipped");
  const importable = toCreate + (mode === "fill_empty" ? duplicates : 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar contactos</DialogTitle>
          <DialogDescription>
            {step === "file" && `Archivo .csv o .xlsx, hasta ${MAX_IMPORT_ROWS.toLocaleString("es-MX")} filas y ${MAX_IMPORT_BYTES / 1024 / 1024} MB. La primera fila son los encabezados.`}
            {step === "map" && `${filename}: ${dataRows.length.toLocaleString("es-MX")} filas. Revisa qué columna va en cada campo.`}
            {step === "preview" && "Vista previa: así quedaría la importación. Aún no se guardó nada."}
            {step === "done" && "Resultado de la importación."}
          </DialogDescription>
        </DialogHeader>

        {step === "file" && (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-borde-control p-8 text-center hover:bg-superficie-2 focus-within:ring-2 focus-within:ring-marca">
              {busy ? <Loader2Icon className="size-8 animate-spin text-texto-suave" aria-hidden /> : <FileSpreadsheetIcon className="size-8 text-texto-suave" aria-hidden />}
              <span className="font-medium">{busy ? "Leyendo archivo…" : "Elegir archivo"}</span>
              <span className="text-xs text-texto-suave">CSV (separado por comas o punto y coma) o Excel .xlsx</span>
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => void onFile(e)}
                disabled={busy}
              />
            </label>
            <Button variant="link" className="h-auto p-0" onClick={downloadTemplate}>
              <DownloadIcon aria-hidden /> Descargar plantilla de ejemplo
            </Button>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">{field.label}</Label>
                  <Select
                    value={String(mapping[field.key])}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [field.key]: Number(v) }))}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value={NONE}>No importar</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Clasificación de los nuevos (si la fila no trae una)</Label>
              <Select value={classification} onValueChange={(v) => setClassification(v as Classification)}>
                <SelectTrigger className="h-9 w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CLASSIFICATION_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-texto-suave">
              Teléfonos de México con o sin +52 / 521. Las etiquetas se separan con coma y deben existir. Los importados no tienen
              WhatsApp hasta que escriban; entonces se vinculan solos por el teléfono.
            </p>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Nuevos" value={toCreate} />
              <Stat label="Ya existen" value={duplicates} />
              <Stat label="Con error u omitidos" value={previewErrors} />
            </div>
            {duplicates > 0 && (
              <fieldset className="space-y-2 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">¿Qué hago con los que ya existen?</legend>
                {(
                  [
                    ["skip", "Omitirlos"],
                    ["fill_empty", "Completar solo sus campos vacíos (nunca cambia lo que ya tienen)"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="modo" value={value} checked={mode === value} onChange={() => setMode(value)} className="accent-(--marca)" />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            <ResultsTable results={preview} />
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <Stat label="Creados" value={count(results, "created")} />
              <Stat label="Actualizados" value={count(results, "updated")} />
              <Stat label="Omitidos" value={count(results, "skipped")} />
              <Stat label="Con error" value={count(results, "error")} />
            </div>
            <ResultsTable results={results.filter((r) => r.status !== "created" || (r.warnings?.length ?? 0) > 0)} emptyText="Todas las filas se crearon sin avisos." />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error-texto">
            {error}
          </p>
        )}

        <DialogFooter>
          {step === "done" ? (
            <Button onClick={close}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={step === "file" ? close : () => setStep(step === "preview" ? "map" : "file")} disabled={busy}>
                {step === "file" ? "Cancelar" : "Atrás"}
              </Button>
              {step === "map" && (
                <Button onClick={() => void runPreview()} disabled={busy}>
                  {busy && <Loader2Icon className="animate-spin" aria-hidden />} Ver vista previa
                </Button>
              )}
              {step === "preview" && (
                <Button onClick={() => void runImport()} disabled={busy || importable === 0}>
                  {busy && <Loader2Icon className="animate-spin" aria-hidden />} Importar {importable.toLocaleString("es-MX")}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-2">
      <p className="text-xl font-semibold tabular-nums">{value.toLocaleString("es-MX")}</p>
      <p className="text-xs text-texto-suave">{label}</p>
    </div>
  );
}

/** Resultado por fila (máximo 300 en pantalla; primero los errores). */
function ResultsTable({ results, emptyText }: { results: ImportRowResult[]; emptyText?: string }) {
  if (results.length === 0) return emptyText ? <p className="text-sm text-texto-suave">{emptyText}</p> : null;
  const order: Record<ImportRowResult["status"], number> = { error: 0, skipped: 1, duplicate: 2, updated: 3, create: 4, created: 5 };
  const sorted = [...results].sort((a, b) => order[a.status] - order[b.status] || a.row - b.row).slice(0, 300);
  return (
    <div className="max-h-72 overflow-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-16">Fila</TableHead>
            <TableHead className="w-28">Estado</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.row}>
              <TableCell className="tabular-nums">{r.row}</TableCell>
              <TableCell className={cn("font-medium", STATUS_TONE[r.status])}>{STATUS_LABELS[r.status]}</TableCell>
              <TableCell className="text-xs whitespace-normal text-texto-suave">
                {[r.reason, ...(r.warnings ?? [])].filter(Boolean).join(" · ") || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {results.length > 300 && <p className="p-2 text-xs text-texto-suave">Se muestran 300 de {results.length.toLocaleString("es-MX")} filas.</p>}
    </div>
  );
}
