// CSV para importar y exportar contactos (lógica pura, sin librerías).
// Exportar: UTF-8 con BOM (Excel muestra bien los acentos) y celdas que
// empiezan con = + - @ (o tabulador/retorno) escapadas contra inyección de
// fórmulas. Importar: RFC 4180 (comillas, saltos de línea dentro de comillas)
// y separador «,» o «;» (Excel en español suele usar «;»).

export const CSV_BOM = "﻿";

/** Evita que Excel interprete la celda como fórmula. */
export function escapeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quote(value: string): string {
  const safe = escapeFormula(value);
  return /[",;\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Filas → texto CSV (con BOM). */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((row) => row.map((cell) => quote(cell == null ? "" : String(cell))).join(","));
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

/** Separador más probable según la primera línea. */
function detectDelimiter(text: string): "," | ";" {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  return (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
}

/** Texto CSV → filas de celdas (sin filas totalmente vacías). */
export function parseCsv(input: string): string[][] {
  const text = input.startsWith(CSV_BOM) ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// --- Columnas de la importación -----------------------------------------------

export const IMPORT_FIELDS = [
  { key: "name", label: "Nombre" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo" },
  { key: "classification", label: "Clasificación" },
  { key: "tags", label: "Etiquetas" },
  { key: "delivery_address", label: "Dirección de entrega" },
  { key: "delivery_references", label: "Referencias" },
  { key: "source", label: "Origen" },
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];

/** Encabezados comunes → campo (sin acentos ni mayúsculas). */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  name: ["nombre", "name", "nombre completo", "cliente", "contacto"],
  phone: ["telefono", "tel", "celular", "movil", "whatsapp", "phone", "numero", "telefono movil"],
  email: ["correo", "email", "e-mail", "correo electronico", "mail"],
  classification: ["clasificacion", "tipo", "classification", "estatus"],
  tags: ["etiquetas", "etiqueta", "tags"],
  delivery_address: ["direccion", "direccion de entrega", "domicilio", "address"],
  delivery_references: ["referencias", "referencia", "indicaciones"],
  source: ["origen", "fuente", "como nos conocio", "source"],
};

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Columna del archivo para cada campo (índice o -1), a partir de los encabezados. */
export function guessMapping(headers: string[]): Record<ImportField, number> {
  const normalized = headers.map(normalizeHeader);
  const mapping = {} as Record<ImportField, number>;
  const used = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    const index = normalized.findIndex((h, i) => !used.has(i) && HEADER_ALIASES[field.key].includes(h));
    mapping[field.key] = index;
    if (index >= 0) used.add(index);
  }
  return mapping;
}

/** Etiquetas escritas «A, B» o «A; B» o «A | B». */
export function splitTags(value: string): string[] {
  return value
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Plantilla de ejemplo para importar. */
export function importTemplateCsv(): string {
  return toCsv(
    IMPORT_FIELDS.map((f) => f.label),
    [
      ["Ana López", "644 407 5142", "ana@ejemplo.com", "Cliente", "Mayoreo, Obra", "Calle Sur 10, Col. Centro", "Portón verde", "Recomendación"],
      ["Juan Pérez", "+52 1 662 123 4567", "", "Prospecto", "", "", "", "Anuncio"],
    ],
  );
}

/** Límites de la importación (los vuelve a aplicar el servidor). */
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
