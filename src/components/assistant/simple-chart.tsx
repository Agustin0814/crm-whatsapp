import type { ChartSpec } from "@/lib/agents/system-plan";
import { cn } from "@/lib/utils";

// Gráfica ligera en SVG (líneas o barras) para las respuestas del asistente.
// Recibe una especificación YA validada por el servidor (solo números de un
// resultado de herramienta); no ejecuta nada del modelo. Colores: tokens de tema.

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];
const W = 320;
const H = 160;
const PAD = { top: 10, right: 8, bottom: 26, left: 36 };

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const n = value / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}

function short(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")} k`;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function SimpleChart({ chart, className }: { chart: ChartSpec; className?: string }) {
  const max = niceMax(Math.max(0, ...chart.series.flatMap((s) => s.values)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = chart.labels.length;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const band = innerW / Math.max(n, 1);
  const barW = Math.max(2, (band * 0.7) / chart.series.length);
  // Muestra como máximo ~6 etiquetas en el eje para que no se encimen.
  const step = Math.max(1, Math.ceil(n / 6));
  const fetched = chart.fetchedAt ? new Date(chart.fetchedAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "";
  const description = `${chart.title || "Gráfica"}: ${chart.series.map((s) => s.label).join(", ")}`;

  return (
    <figure className={cn("space-y-2 rounded-xl border bg-background p-3", className)}>
      {chart.title && <figcaption className="text-sm font-semibold">{chart.title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={description}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(max * f)} y2={y(max * f)} stroke="var(--borde)" strokeWidth={1} />
            <text x={PAD.left - 4} y={y(max * f) + 3} textAnchor="end" fontSize={9} fill="var(--texto-suave)">
              {short(max * f)}
            </text>
          </g>
        ))}
        {chart.labels.map((label, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={i}
              x={chart.type === "bar" ? PAD.left + band * i + band / 2 : x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={9}
              fill="var(--texto-suave)"
            >
              {label.length > 10 ? label.slice(-5) : label}
            </text>
          ) : null,
        )}
        {chart.type === "bar"
          ? chart.series.map((s, si) =>
              s.values.map((v, i) => (
                <rect
                  key={`${si}-${i}`}
                  x={PAD.left + band * i + (band - barW * chart.series.length) / 2 + barW * si}
                  y={y(v)}
                  width={barW}
                  height={Math.max(0, PAD.top + innerH - y(v))}
                  rx={2}
                  fill={COLORS[si % COLORS.length]}
                >
                  <title>{`${chart.labels[i]} · ${s.label}: ${v.toLocaleString("es-MX")}`}</title>
                </rect>
              )),
            )
          : chart.series.map((s, si) => (
              <g key={si}>
                <polyline
                  fill="none"
                  stroke={COLORS[si % COLORS.length]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={COLORS[si % COLORS.length]}>
                    <title>{`${chart.labels[i]} · ${s.label}: ${v.toLocaleString("es-MX")}`}</title>
                  </circle>
                ))}
              </g>
            ))}
      </svg>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
        {chart.series.map((s, si) => (
          <span key={si} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: COLORS[si % COLORS.length] }} aria-hidden />
            {s.label}
          </span>
        ))}
        {fetched && <span className="ml-auto">Datos del {fetched}</span>}
      </div>
      {/* Los mismos datos como tabla para lectores de pantalla. */}
      <table className="sr-only">
        <thead>
          <tr>
            <th>Periodo</th>
            {chart.series.map((s, si) => (
              <th key={si}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.labels.map((label, i) => (
            <tr key={i}>
              <td>{label}</td>
              {chart.series.map((s, si) => (
                <td key={si}>{s.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
