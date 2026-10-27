import { HELP_ARTICLES, type HelpArticle } from "./articles.generated";

// Búsqueda simple en el manual (src/content/ayuda). Lógica pura: sin acentos ni
// mayúsculas, por prefijo de palabra, con más peso en temas y título.

const STOPWORDS = new Set(
  "a al como con cual cuales de del el en es esta este esto la las lo los me mi mis o para por que se si su sus un una uno y yo hay hacer puedo puede cómo qué".split(" "),
);

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function words(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Coincide si la palabra del texto empieza con la de la consulta (o al revés, para plurales cortos). */
function matches(token: string, candidates: string[]): boolean {
  return candidates.some((c) => c.startsWith(token) || (token.length > 4 && token.startsWith(c) && c.length >= 4));
}

export type HelpHit = { slug: string; title: string; body: string; score: number };

/** Hasta `limit` artículos relevantes, del más al menos parecido. Vacío si nada coincide. */
export function searchHelp(query: string, limit = 2, articles: HelpArticle[] = HELP_ARTICLES): HelpHit[] {
  const tokens = [...new Set(words(query))];
  if (!tokens.length) return [];
  const scored = articles.map((a) => {
    const topicWords = a.topics.flatMap(words);
    const titleWords = words(a.title);
    const bodyWords = words(a.body);
    let score = 0;
    for (const t of tokens) {
      if (matches(t, topicWords)) score += 4;
      if (matches(t, titleWords)) score += 3;
      if (matches(t, bodyWords)) score += 1;
    }
    // Frases completas de los temas («asistente de respuestas») pesan más.
    const q = normalizeText(query);
    for (const topic of a.topics) if (topic.includes(" ") && q.includes(normalizeText(topic))) score += 6;
    return { slug: a.slug, title: a.title, body: a.body, score };
  });
  return scored
    .filter((h) => h.score >= 4)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
