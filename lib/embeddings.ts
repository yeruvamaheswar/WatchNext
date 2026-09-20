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

function isOpenAI429(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; code?: string; message?: string };
  const message = String(e.message ?? err);
  return (
    e.status === 429 ||
    e.code === "rate_limit_exceeded" ||
    e.code === "insufficient_quota" ||
    /429|insufficient[_ ]quota|no credits remaining|rate limit/i.test(message)
  );
}

async function createEmbeddings(texts: string[]) {
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

/** Embed texts. Retry once on 429; if still no credits, throw that error. */
export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  try {
    return await createEmbeddings(texts);
  } catch (err) {
    if (!isOpenAI429(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await createEmbeddings(texts);
  }
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

/** Title + overview/description + tags (keywords and genres). Extra fields stay for retrieval. */
export function titleEmbedText(input: {
  name: string;
  overview?: string | null;
  genres?: string[];
  keywords?: string[];
  tagline?: string | null;
  topCast?: string[];
  directors?: string[];
  creators?: string[];
  mediaType?: string;
  year?: number | null;
}) {
  const tags = [
    ...(input.genres ?? []),
    ...(input.keywords ?? []),
  ].filter(Boolean);
  return [
    input.name,
    input.year ? String(input.year) : "",
    input.mediaType ?? "",
    input.tagline ?? "",
    tags.length ? `tags: ${tags.join(", ")}` : "",
    input.directors?.length ? `director: ${input.directors.join(", ")}` : "",
    input.creators?.length ? `creator: ${input.creators.join(", ")}` : "",
    (input.topCast ?? []).join(", "),
    input.overview ?? "",
  ]
    .filter(Boolean)
    .join(". ");
}
