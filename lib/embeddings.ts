import { ConfigError } from "@/lib/config-error";
import { getOpenAI, openaiModels } from "@/lib/openai";

export function l2Normalize(values: number[]) {
  const mag = Math.sqrt(values.reduce((sum, n) => sum + n * n, 0)) || 1;
  return values.map((n) => n / mag);
}

export function meanVectors(vectors: number[][]) {
  if (vectors.length === 0) return null;
  const dim = vectors[0].length;
  const acc = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) acc[i] += v[i] ?? 0;
  }
  return l2Normalize(acc.map((n) => n / vectors.length));
}

export function blendVectors(
  query: number[],
  taste: number[] | null,
  queryWeight = 0.55
) {
  if (!taste || taste.length !== query.length) return l2Normalize(query);
  const tasteWeight = 1 - queryWeight;
  return l2Normalize(
    query.map((n, i) => n * queryWeight + (taste[i] ?? 0) * tasteWeight)
  );
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  const openai = getOpenAI();
  const { embedding } = openaiModels();
  const response = await openai.embeddings.create({
    model: embedding,
    input: texts.map((t) => t.slice(0, 8000)),
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((row) => row.embedding);
}

export async function embedText(text: string) {
  const [vector] = await embedTexts([text || "something great to watch"]);
  if (!vector) {
    throw new ConfigError(
      "Embedding failed.",
      "EMBED_FAILED",
      "Check OPENAI_API_KEY and network access to api.openai.com."
    );
  }
  return vector;
}

export function titleEmbedText(input: {
  name: string;
  overview?: string | null;
  genres?: string[];
  keywords?: string[];
  tagline?: string | null;
  topCast?: string[];
  mediaType?: string;
  year?: number | null;
}) {
  return [
    input.name,
    input.year ? String(input.year) : "",
    input.mediaType ?? "",
    input.tagline ?? "",
    (input.genres ?? []).join(", "),
    (input.keywords ?? []).join(", "),
    (input.topCast ?? []).join(", "),
    input.overview ?? "",
  ]
    .filter(Boolean)
    .join(". ");
}
