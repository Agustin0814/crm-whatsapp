// Genera src/lib/help/articles.generated.ts (y titles.generated.ts) a partir de los artículos del
// manual (src/content/ayuda/*.md). Así el servidor los tiene en el bundle sin
// leer archivos en tiempo de ejecución (Vercel).
//
// Uso: npm run ayuda (también corre antes de `npm run build`).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src", "content", "ayuda");
const out = join(root, "src", "lib", "help", "articles.generated.ts");
// Solo los títulos, para el navegador (citas «Del manual: …») sin cargar los textos.
const outTitles = join(root, "src", "lib", "help", "titles.generated.ts");

function parse(file) {
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: falta el encabezado --- titulo/temas ---`);
  const meta = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  if (!meta.titulo) throw new Error(`${file}: falta «titulo»`);
  return {
    slug: basename(file, ".md"),
    title: meta.titulo,
    topics: (meta.temas ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    body: match[2].trim(),
  };
}

const articles = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => parse(join(dir, f)));

const source = `// Archivo generado por scripts/generar-ayuda.mjs. No editar a mano:
// edita src/content/ayuda/*.md y ejecuta \`npm run ayuda\`.

export type HelpArticle = { slug: string; title: string; topics: string[]; body: string };

export const HELP_ARTICLES: HelpArticle[] = ${JSON.stringify(articles, null, 2)};
`;
writeFileSync(out, source);
const titles = Object.fromEntries(articles.map((a) => [a.slug, a.title]));
writeFileSync(
  outTitles,
  `// Archivo generado por scripts/generar-ayuda.mjs. No editar a mano.

export const HELP_TITLES: Record<string, string> = ${JSON.stringify(titles, null, 2)};
`,
);
console.log(`Ayuda: ${articles.length} artículos → ${out}`);
