// Lógica PURA del Asistente del sistema: roles de las herramientas, contrato de
// la respuesta final (`responder`), gráficas construidas por el servidor y
// forma de los turnos guardados. Sin acceso a la base ni al modelo.

import type { ToolDefinition } from "./provider";

export type AssistantRole = "agent" | "admin" | "superadmin";

export const ROLE_RANK: Record<AssistantRole, number> = { agent: 1, admin: 2, superadmin: 3 };

export function isAssistantRole(value: unknown): value is AssistantRole {
  return value === "agent" || value === "admin" || value === "superadmin";
}

export function maxRole(a: AssistantRole, b: AssistantRole): AssistantRole {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

export function hasRole(role: AssistantRole, needed: AssistantRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[needed];
}

/** Lista CERRADA de herramientas. Ninguna escribe datos del CRM. */
export const SYSTEM_TOOL_NAMES = [
  "buscar_ayuda",
  "estado_agentes",
  "conteo_mensajes",
  "conteo_contactos",
  "respuestas_rapidas",
  "buscar_contactos",
  "leer_conversacion",
  "resumir_conversacion",
  "info_negocio",
  "actividad_agentes",
  "consumo_agentes",
  "proponer_tarea",
] as const;

export type SystemToolName = (typeof SYSTEM_TOOL_NAMES)[number];

export function isSystemToolName(value: string): value is SystemToolName {
  return (SYSTEM_TOOL_NAMES as readonly string[]).includes(value);
}

/** Piso de rol de cada herramienta: el proveedor puede subirlo, nunca bajarlo. */
export const TOOL_FLOOR: Record<SystemToolName, AssistantRole> = {
  buscar_ayuda: "agent",
  estado_agentes: "agent",
  conteo_mensajes: "agent",
  conteo_contactos: "agent",
  respuestas_rapidas: "agent",
  buscar_contactos: "agent",
  leer_conversacion: "agent",
  resumir_conversacion: "agent",
  info_negocio: "agent",
  actividad_agentes: "admin",
  consumo_agentes: "admin",
  proponer_tarea: "agent",
};

/** Etiquetas para el panel del proveedor. */
export const SYSTEM_TOOL_LABELS: Record<SystemToolName, string> = {
  buscar_ayuda: "Manual de ayuda",
  estado_agentes: "Estado de los agentes",
  conteo_mensajes: "Conteo de mensajes",
  conteo_contactos: "Conteo de contactos y chats",
  respuestas_rapidas: "Respuestas rápidas",
  buscar_contactos: "Buscar contactos",
  leer_conversacion: "Leer una conversación",
  resumir_conversacion: "Resumir una conversación",
  info_negocio: "Información del negocio",
  actividad_agentes: "Registro de actividad",
  consumo_agentes: "Consumo y costos",
  proponer_tarea: "Pedir tareas a otros agentes",
};

/** Rol mínimo efectivo = el mayor entre el piso y lo que fijó el proveedor. */
export function toolMinRole(name: SystemToolName, overrides: unknown): AssistantRole {
  const floor = TOOL_FLOOR[name];
  const raw = overrides && typeof overrides === "object" ? (overrides as Record<string, unknown>)[name] : undefined;
  return isAssistantRole(raw) ? maxRole(floor, raw) : floor;
}

// ---------------------------------------------------------------------------
// Resultados de herramientas y turnos
// ---------------------------------------------------------------------------

export type ToolResult = {
  /** Identificador dentro del chat («r1», «r2»…), para citarlo en gráficas. */
  id: string;
  tool: SystemToolName;
  /** Cuándo se obtuvo (el modelo decide si reutilizarlo). */
  fetchedAt: string;
  /** Rol que exigió la herramienta (sube el min_role del chat). */
  minRole: AssistantRole;
  /** Datos ya recortados. */
  data: unknown;
  /** Conversaciones que el usuario nombró explícitamente (búsqueda con un término de su pregunta). */
  named: string[];
};

export type ChartSpec = {
  type: "line" | "bar";
  title: string;
  labels: string[];
  series: { label: string; values: number[] }[];
  /** Resultado del que salen los datos y su fecha. */
  sourceId: string;
  fetchedAt: string;
};

export type StoredTurn = {
  question: string;
  answer: string;
  at: string;
  results: ToolResult[];
  chart: ChartSpec | null;
  articles: string[];
  requestIds: string[];
};

/** Rol mínimo para ver un turno: el mayor que exigió alguna herramienta usada. */
export function turnMinRole(turn: Pick<StoredTurn, "results">): AssistantRole {
  return turn.results.reduce<AssistantRole>((acc, r) => maxRole(acc, r.minRole), "agent");
}

/** JSON recortado para el modelo (nunca más de `maxChars`). */
export function trimForModel(data: unknown, maxChars: number): string {
  const text = JSON.stringify(data) ?? "null";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 40))}… [recortado: ${text.length} caracteres]`;
}

// ---------------------------------------------------------------------------
// Respuesta final
// ---------------------------------------------------------------------------

export const FINAL_TOOL_NAME = "responder";

export const FINAL_TOOL: ToolDefinition = {
  name: FINAL_TOOL_NAME,
  description:
    "Respuesta final para la persona del equipo. Llámala SIEMPRE para terminar. El texto usa markdown sencillo (listas, **negritas**, tablas cortas).",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["texto", "articulos", "grafica"],
    properties: {
      texto: { type: "string", description: "Respuesta en español, clara y breve." },
      articulos: {
        type: "array",
        description: "Identificadores (slug) de los artículos del manual que usaste. Vacío si no usaste el manual.",
        items: { type: "string" },
      },
      grafica: {
        description: "Gráfica opcional, SOLO con datos de un resultado de herramienta. null si no se pidió.",
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["tipo", "titulo", "resultado_id", "eje_x", "series"],
            properties: {
              tipo: { type: "string", enum: ["linea", "barras"] },
              titulo: { type: "string" },
              resultado_id: { type: "string", description: "id del resultado (r1, r2…) que tiene «filas»." },
              eje_x: { type: "string", description: "Campo de cada fila para las etiquetas del eje horizontal." },
              series: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["campo", "etiqueta"],
                  properties: { campo: { type: "string" }, etiqueta: { type: "string" } },
                },
              },
            },
          },
        ],
      },
    },
  },
};

export type ChartRequest = { type: "line" | "bar"; title: string; sourceId: string; xField: string; series: { field: string; label: string }[] };

export type FinalAnswer = { text: string; articles: string[]; chart: ChartRequest | null };

export const ANSWER_MAX_CHARS = 6000;

/**
 * Quita del texto las referencias internas que a veces escribe el modelo
 * («(slug: x)», «Fuente: … (artículo: x)»): la interfaz ya muestra «Del manual».
 */
export function cleanAnswer(text: string, slugs: string[]): string {
  let out = text
    .split("\n")
    .filter((line) => !/^\s*(\*\*)?(fuente|fuentes|art[ií]culos? (?:consultados?|usados?))(\*\*)?\s*:/i.test(line))
    .join("\n");
  out = out.replace(/\s*\((?:slug|art[ií]culo|id)\s*:\s*[^)]*\)/gi, "");
  // Slugs sueltos del manual (solo minúsculas y guiones, como en src/content/ayuda).
  for (const slug of slugs) out = out.replace(new RegExp(`\\s*\\(?\\b${slug}\\b\\)?`, "g"), (m) => (slug.includes("-") ? "" : m));
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function parseFinal(args: Record<string, unknown> | null): FinalAnswer | null {
  if (!args) return null;
  const text = typeof args.texto === "string" ? args.texto.trim().slice(0, ANSWER_MAX_CHARS) : "";
  if (!text) return null;
  const articles = Array.isArray(args.articulos) ? [...new Set(args.articulos.filter((a): a is string => typeof a === "string"))].slice(0, 5) : [];
  let chart: ChartRequest | null = null;
  const g = args.grafica;
  if (g && typeof g === "object") {
    const c = g as Record<string, unknown>;
    const series = Array.isArray(c.series)
      ? c.series
          .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : {}))
          .filter((s) => typeof s.campo === "string")
          .map((s) => ({ field: String(s.campo), label: typeof s.etiqueta === "string" && s.etiqueta.trim() ? s.etiqueta.trim().slice(0, 40) : String(s.campo) }))
      : [];
    if (typeof c.resultado_id === "string" && typeof c.eje_x === "string" && series.length) {
      chart = {
        type: c.tipo === "linea" ? "line" : "bar",
        title: typeof c.titulo === "string" ? c.titulo.trim().slice(0, 80) : "",
        sourceId: c.resultado_id,
        xField: c.eje_x,
        series,
      };
    }
  }
  return { text, articles, chart };
}

export const CHART_MAX_SERIES = 4;
export const CHART_MAX_POINTS = 60;

/**
 * La gráfica la arma el SERVIDOR con los datos reales del resultado citado: el
 * modelo solo elige campos. Si algo no cuadra (resultado inexistente, campos
 * que no son números…), no hay gráfica.
 */
export function buildChart(request: ChartRequest | null, results: ToolResult[]): ChartSpec | null {
  if (!request) return null;
  const source = results.find((r) => r.id === request.sourceId);
  const rows = source && source.data && typeof source.data === "object" ? (source.data as { filas?: unknown }).filas : null;
  if (!source || !Array.isArray(rows) || rows.length === 0 || rows.length > CHART_MAX_POINTS) return null;
  const objects = rows.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  if (objects.length !== rows.length) return null;
  const labels = objects.map((r) => r[request.xField]);
  if (!labels.every((l) => typeof l === "string" || typeof l === "number")) return null;
  const series = request.series.slice(0, CHART_MAX_SERIES).map((s) => ({
    label: s.label,
    values: objects.map((r) => r[s.field]),
  }));
  if (!series.every((s) => s.values.every((v) => typeof v === "number" && Number.isFinite(v)))) return null;
  return {
    type: request.type,
    title: request.title,
    labels: labels.map(String),
    series: series.map((s) => ({ label: s.label, values: s.values as number[] })),
    sourceId: source.id,
    fetchedAt: source.fetchedAt,
  };
}

/** Siguiente id libre de resultado («r7») dado lo que ya hay en el chat. */
export function nextResultId(existing: ToolResult[]): (offset: number) => string {
  const max = existing.reduce((acc, r) => Math.max(acc, Number(r.id.slice(1)) || 0), 0);
  return (offset) => `r${max + offset}`;
}

/** Conversaciones nombradas por el usuario en los turnos anteriores (para delegar). */
export function namedConversations(turns: Pick<StoredTurn, "results">[]): Set<string> {
  return new Set(turns.flatMap((t) => t.results.flatMap((r) => r.named)));
}

// ---------------------------------------------------------------------------
// Forma segura de los turnos (firmados o leídos de la base)
// ---------------------------------------------------------------------------

function sanitizeResult(r: unknown): ToolResult | null {
  if (!r || typeof r !== "object") return null;
  const x = r as Record<string, unknown>;
  if (typeof x.id !== "string" || typeof x.tool !== "string" || !isSystemToolName(x.tool) || !isAssistantRole(x.minRole)) return null;
  return {
    id: x.id,
    tool: x.tool,
    fetchedAt: typeof x.fetchedAt === "string" ? x.fetchedAt : "",
    minRole: x.minRole,
    data: x.data ?? null,
    named: Array.isArray(x.named) ? x.named.filter((n): n is string => typeof n === "string") : [],
  };
}

/** Forma segura de un turno (también para los que vienen de la base). */
export function sanitizeTurn(t: StoredTurn): StoredTurn {
  return {
    question: String(t.question ?? ""),
    answer: String(t.answer ?? ""),
    at: String(t.at ?? ""),
    results: Array.isArray(t.results) ? t.results.map(sanitizeResult).filter((r): r is ToolResult => !!r) : [],
    chart: t.chart ?? null,
    articles: Array.isArray(t.articles) ? t.articles.filter((a): a is string => typeof a === "string") : [],
    requestIds: Array.isArray(t.requestIds) ? t.requestIds.filter((a): a is string => typeof a === "string") : [],
  };
}

export type AssistantMessageRow = { role: string; content: string; tool_name: string | null; tool_data: unknown; fetched_at: string | null; chart: unknown; created_at: string };

/** Reconstruye los turnos a partir de las filas de assistant_messages (en orden). */
export function rowsToTurns(rows: AssistantMessageRow[]): StoredTurn[] {
  const turns: StoredTurn[] = [];
  let current: StoredTurn | null = null;
  for (const row of rows) {
    if (row.role === "user") {
      current = { question: row.content, answer: "", at: row.created_at, results: [], chart: null, articles: [], requestIds: [] };
      turns.push(current);
      continue;
    }
    if (!current) continue;
    const data = (row.tool_data ?? {}) as Record<string, unknown>;
    if (row.role === "tool" && row.tool_name && isSystemToolName(row.tool_name) && typeof data.id === "string") {
      current.results.push({
        id: data.id,
        tool: row.tool_name,
        fetchedAt: row.fetched_at ?? row.created_at,
        minRole: isAssistantRole(data.min_role) ? data.min_role : "agent",
        data: data.data ?? null,
        named: Array.isArray(data.named) ? data.named.filter((n): n is string => typeof n === "string") : [],
      });
    } else if (row.role === "assistant") {
      current.answer = row.content;
      current.chart = (row.chart as StoredTurn["chart"]) ?? null;
      current.articles = Array.isArray(data.articles) ? data.articles.filter((a): a is string => typeof a === "string") : [];
      current.requestIds = Array.isArray(data.request_ids) ? data.request_ids.filter((a): a is string => typeof a === "string") : [];
    }
  }
  return turns.map(sanitizeTurn);
}
