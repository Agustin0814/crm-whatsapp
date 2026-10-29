import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isClassification } from "@/lib/crm/types";
import type { Json } from "@/lib/supabase/database.types";

// Importa contactos (solo administrador y superadmin). El navegador lee el
// archivo (CSV o .xlsx) y manda las filas ya asignadas a columnas: el archivo
// nunca pasa por aquí (Vercel limita el cuerpo). Todo se vuelve a validar:
// tamaño, número de filas, largo de cada campo y, en la base,
// import_contacts (teléfonos, duplicados, clasificación, etiquetas). Se
// procesa en lotes de 500 con la SESIÓN del administrador (RLS).

import { MAX_IMPORT_ROWS } from "@/lib/crm/csv";
const BATCH = 500;
const LIMITS: Record<string, number> = {
  name: 200,
  phone: 40,
  email: 254,
  classification: 40,
  delivery_address: 500,
  delivery_references: 500,
  source: 40,
};

export type ImportRowResult = {
  row: number;
  status: "create" | "duplicate" | "created" | "updated" | "skipped" | "error";
  reason?: string;
  warnings?: string[];
};

type CleanRow = Record<string, string | number | string[]>;

function cleanRow(raw: unknown): CleanRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const row = Number(o.row);
  if (!Number.isInteger(row) || row < 1) return null;
  const out: CleanRow = { row };
  for (const [key, max] of Object.entries(LIMITS)) {
    const value = o[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, max);
  }
  if (Array.isArray(o.tags)) {
    out.tags = o.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim().slice(0, 60)).filter(Boolean).slice(0, 20);
  }
  return out;
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { supabase } = check;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.rows)) return NextResponse.json({ error: "Petición no válida" }, { status: 400 });
  if (body.rows.length === 0) return NextResponse.json({ error: "El archivo no tiene filas" }, { status: 400 });
  if (body.rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Máximo ${MAX_IMPORT_ROWS.toLocaleString("es-MX")} filas por archivo` }, { status: 400 });
  }
  const mode = body.mode === "fill_empty" ? "fill_empty" : "skip";
  const defaultClassification = isClassification(body.defaultClassification as string) ? (body.defaultClassification as string) : "unclassified";
  const dryRun = body.dryRun !== false;
  const filename = typeof body.filename === "string" ? body.filename.slice(0, 200) : null;

  const rows = body.rows.map(cleanRow);
  if (rows.some((r) => r === null)) return NextResponse.json({ error: "Hay filas con formato no válido" }, { status: 400 });

  const results: ImportRowResult[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await supabase.rpc("import_contacts", {
      p_rows: rows.slice(i, i + BATCH) as unknown as Json,
      p_mode: mode,
      p_default_classification: defaultClassification,
      p_dry_run: dryRun,
    });
    if (error) {
      console.error(`[contacts-import] Falló el lote ${i / BATCH + 1}`);
      return NextResponse.json(
        { error: i === 0 ? "No se pudo procesar el archivo" : `Se detuvo en la fila ${i + 1}; las anteriores ya se guardaron.`, results },
        { status: 500 },
      );
    }
    results.push(...(data as unknown as ImportRowResult[]));
  }

  if (!dryRun) {
    const count = (s: ImportRowResult["status"]) => results.filter((r) => r.status === s).length;
    const { error: logError } = await supabase.from("contact_imports").insert({
      user_id: check.userId,
      filename,
      mode,
      default_classification: defaultClassification,
      total: results.length,
      created: count("created"),
      updated: count("updated"),
      skipped: count("skipped"),
      errors: count("error"),
    });
    if (logError) console.error("[contacts-import] No se pudo registrar la importación");
  }
  return NextResponse.json({ results });
}
