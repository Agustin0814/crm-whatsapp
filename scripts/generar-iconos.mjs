// Genera src/components/ui/icon-data.ts a partir de los SVG originales de
// public/icons (y de la ilustración public/brand/vacio-bandeja.svg).
// Los archivos de public/ no se modifican: solo se leen.
//
// Uso: npm run iconos
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const extra = { "vacio-bandeja": join(root, "public", "brand", "vacio-bandeja.svg") };
const out = join(root, "src", "components", "ui", "icon-data.ts");

// Elementos y atributos geométricos permitidos (el resto se descarta).
const ELEMENTS = ["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"];
const ATTRS = ["d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points"];

function parse(file) {
  const svg = readFileSync(file, "utf8");
  if (/<image|base64/.test(svg)) throw new Error(`${file} contiene imágenes incrustadas`);
  const nodes = [];
  const re = new RegExp(`<(${ELEMENTS.join("|")})\\b([^>]*?)\\/?>`, "g");
  for (const [, tag, rawAttrs] of svg.matchAll(re)) {
    const attrs = {};
    for (const [, name, value] of rawAttrs.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)) {
      if (ATTRS.includes(name)) attrs[name] = value;
    }
    nodes.push([tag, attrs]);
  }
  if (nodes.length === 0) throw new Error(`${file} no tiene formas reconocibles`);
  return nodes;
}

const icons = {};
for (const file of readdirSync(iconsDir).filter((f) => f.endsWith(".svg")).sort()) {
  icons[file.replace(/^icon-/, "").replace(/\.svg$/, "")] = parse(join(iconsDir, file));
}
for (const [name, file] of Object.entries(extra)) icons[name] = parse(file);

const body = Object.entries(icons)
  .map(([name, nodes]) => `  ${JSON.stringify(name)}: ${JSON.stringify(nodes)},`)
  .join("\n");

writeFileSync(
  out,
  `// ARCHIVO GENERADO por scripts/generar-iconos.mjs — no editar a mano.
// Fuente: public/icons/*.svg y public/brand/vacio-bandeja.svg (viewBox 0 0 24 24, trazo).

export type IconNode = readonly [tag: string, attrs: Readonly<Record<string, string>>];

export const ICON_DATA = {
${body}
} as const satisfies Record<string, readonly IconNode[]>;

export type IconName = keyof typeof ICON_DATA;
`,
);
console.log(`Generados ${Object.keys(icons).length} iconos en ${out}`);
