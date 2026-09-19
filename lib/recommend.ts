import { ConfigError } from "@/lib/config-error";
import { blendVectors, embedText, meanVectors } from "@/lib/embeddings";
import { getServerEnv } from "@/lib/env";
import { getOpenAI, openaiModels } from "@/lib/openai";
import { createAdminSupabase, tryCreateAdminSupabase } from "@/lib/supabase/admin";
import {
  supabaseFetchTimeoutMs,
  supabaseUnreachableHint,
  supabaseUnreachableMessage,
} from "@/lib/supabase/timeout";
import { VIBE_CARDS } from "@/lib/onboarding-catalog";
import { fetchPosterPath } from "@/lib/tmdb";
import { withTimeout } from "@/lib/with-timeout";
import type {
  ExtractedIntent,
  GuestLike,
  RecommendInput,
  RecommendResult,
  SuggestedTitle,
} from "@/lib/types";

type MatchRow = {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  name: string;
  year: number | null;
  overview: string | null;
  genres: string[] | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number | null;
  popularity: number | null;
  tagline: string | null;
  top_cast: string[] | null;
  distance: number;
};

function vibePrompt(ids: string[]) {
  return ids
    .map((id) => VIBE_CARDS.find((v) => v.id === id)?.prompt)
    .filter(Boolean)
    .join("; ");
}

function buildQueryText(input: RecommendInput) {
  const extract = input.extract;
  const vibeBit = vibePrompt(input.likedVibes ?? []);
  if (extract) {
    const parts = [
      extract.searchQuery,
      extract.moods.length ? `moods: ${extract.moods.join(", ")}` : "",
      extract.genres.length ? `genres: ${extract.genres.join(", ")}` : "",
      extract.people.length ? `people: ${extract.people.join(", ")}` : "",
      extract.titles.length ? `mentioned: ${extract.titles.join(", ")}` : "",
      extract.constraints.length
        ? `constraints: ${extract.constraints.join(", ")}`
        : "",
      vibeBit ? `liked vibes: ${vibeBit}` : "",
    ].filter(Boolean);
    if (parts.length) return parts.join(". ");
  }
  const raw = input.queryText?.trim();
  if (raw) return vibeBit ? `${raw}. liked vibes: ${vibeBit}` : raw;
  return vibeBit
    ? `just pick something great to watch tonight. liked vibes: ${vibeBit}`
    : "just pick something great to watch tonight";
}

async function loadTasteVector(userId: string | null | undefined) {
  if (!userId) return null;
  const supabase = tryCreateAdminSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("taste_embedding")
    .eq("id", userId)
    .maybeSingle();
  const embedding = data?.taste_embedding;
  if (Array.isArray(embedding) && embedding.length) return embedding as number[];
  return null;
}

async function tasteFromLikes(likes: GuestLike[] | undefined) {
  const likedIds = (likes ?? [])
    .filter((l) => l.verdict === "like")
    .map((l) => l.tmdbId);
  if (likedIds.length === 0) return null;
  const supabase = tryCreateAdminSupabase();
  if (!supabase) return null;
  const { data: titles } = await supabase
    .from("titles")
    .select("id")
    .in("tmdb_id", likedIds);
  const ids = (titles ?? []).map((t) => t.id);
  if (ids.length === 0) return null;
  const { data: embeddings } = await supabase
    .from("title_embeddings")
    .select("embedding")
    .in("title_id", ids);
  const vectors = (embeddings ?? [])
    .map((row) => row.embedding as number[])
    .filter((v) => Array.isArray(v) && v.length);
  return meanVectors(vectors);
}

function dislikedIds(likes: GuestLike[] | undefined) {
  return (likes ?? [])
    .filter((l) => l.verdict === "dislike")
    .map((l) => l.tmdbId);
}

function parseExcludeGenres(extract?: ExtractedIntent | null) {
  const extra = extract?.excludeGenres ?? [];
  const fromConstraints = (extract?.constraints ?? [])
    .filter((c) => /not |no |without |skip /i.test(c))
    .flatMap((c) => {
      const lower = c.toLowerCase();
      const out: string[] = [];
      if (/scar|horror/i.test(lower)) out.push("Horror");
      if (/violen/i.test(lower)) out.push("Thriller");
      if (/romanc|romcom/i.test(lower)) out.push("Romance");
      return out;
    });
  return [...new Set([...extra, ...fromConstraints])];
}

async function llmPick(
  candidates: MatchRow[],
  queryText: string,
  extract?: ExtractedIntent | null
): Promise<RecommendResult> {
  const openai = getOpenAI();
  const { chat } = openaiModels();
  const catalog = candidates.map((c) => ({
    id: c.id,
    tmdbId: c.tmdb_id,
    mediaType: c.media_type,
    name: c.name,
    year: c.year,
    genres: c.genres,
    overview: (c.overview ?? "").slice(0, 280),
    voteAverage: c.vote_average,
  }));

  const completion = await openai.chat.completions.create({
    model: chat,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You pick 1-3 titles from a candidate list for a watch-now recommendation. Reply JSON: { \"picks\": [{ \"id\": string, \"reason\": string }], \"spokenPitch\": string }. spokenPitch is one spoken sentence (under 25 words) for TTS. Reasons are one line, why it matches the request. Never invent ids.",
      },
      {
        role: "user",
        content: JSON.stringify({
          request: queryText,
          extract: extract ?? null,
          candidates: catalog,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { picks?: { id: string; reason: string }[]; spokenPitch?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const picks = (parsed.picks ?? [])
    .map((p) => {
      const row = byId.get(p.id);
      if (!row) return null;
      return toSuggested(row, p.reason);
    })
    .filter((p): p is SuggestedTitle => Boolean(p))
    .slice(0, 3);

  const titles =
    picks.length > 0
      ? picks
      : candidates.slice(0, 3).map((row, i) =>
          toSuggested(
            row,
            i === 0 ? "Closest match to what you asked for." : "Another strong fit."
          )
        );

  const spokenPitch =
    parsed.spokenPitch?.trim() ||
    (titles[0]
      ? `Try ${titles[0].name}${titles[0].year ? ` (${titles[0].year})` : ""}.`
      : "I could not find a match in the catalog.");

  return { titles: await withTmdbPosters(titles), spokenPitch };
}

async function withTmdbPosters(titles: SuggestedTitle[]): Promise<SuggestedTitle[]> {
  if (!getServerEnv().tmdbKey) return titles;
  return Promise.all(
    titles.map(async (title) => {
      if (title.posterPath) return title;
      try {
        const posterPath = await withTimeout(
          fetchPosterPath(title.mediaType, title.tmdbId),
          1500
        );
        return posterPath ? { ...title, posterPath } : title;
      } catch {
        return title;
      }
    })
  );
}

function toSuggested(row: MatchRow, reason: string): SuggestedTitle {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    name: row.name,
    year: row.year,
    overview: row.overview ?? "",
    genres: row.genres ?? [],
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    voteAverage: row.vote_average,
    tagline: row.tagline,
    topCast: row.top_cast ?? [],
    reason,
    distance: row.distance,
  };
}

/**
 * Shared solo + room recommender: blend query + taste, exclude dislikes,
 * pgvector RPC, then an LLM picks 1–3 titles with a spoken reason.
 */
export async function recommend(input: RecommendInput): Promise<RecommendResult> {
  const supabase = createAdminSupabase();
  const supabaseUrl = getServerEnv().supabaseUrl;
  const dbTimeout = supabaseFetchTimeoutMs(supabaseUrl);
  let count: number | null = null;
  try {
    const result = await withTimeout(
      supabase.from("titles").select("id", { count: "exact", head: true }),
      dbTimeout
    );
    if (result.error) {
      throw new ConfigError(
        supabaseUnreachableMessage(supabaseUrl),
        "SUPABASE_UNREACHABLE",
        supabaseUnreachableHint(supabaseUrl)
      );
    }
    count = result.count;
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    throw new ConfigError(
      supabaseUnreachableMessage(supabaseUrl),
      "SUPABASE_UNREACHABLE",
      supabaseUnreachableHint(supabaseUrl)
    );
  }
  if (!count) {
    throw new ConfigError(
      "The catalog is empty.",
      "EMPTY_CATALOG",
      "Run `npm run ingest` after setting TMDB_API_KEY and OPENAI_API_KEY."
    );
  }

  const queryText = buildQueryText(input);
  const queryEmbedding = await embedText(queryText);
  const storedTaste = await loadTasteVector(input.userId);
  const likeTaste = storedTaste ?? (await tasteFromLikes(input.likes));
  const blended = blendVectors(queryEmbedding, likeTaste, 0.55);

  const exclude = [
    ...new Set([
      ...dislikedIds(input.likes),
      ...(input.excludeTmdbIds ?? []),
      ...(input.sessionExcludeIds ?? []),
    ]),
  ];

  const mediaType =
    input.extract?.mediaType && input.extract.mediaType !== "any"
      ? input.extract.mediaType
      : null;

  const includeGenres =
    input.extract?.genres && input.extract.genres.length
      ? input.extract.genres
      : null;
  const excludeGenres = parseExcludeGenres(input.extract).length
    ? parseExcludeGenres(input.extract)
    : null;

  async function search(include: string[] | null) {
    return supabase.rpc("match_titles", {
      query_embedding: blended,
      match_count: 15,
      filter_media_type: mediaType,
      exclude_tmdb_ids: exclude,
      include_genres: include,
      exclude_genres: excludeGenres,
      min_year: input.extract?.minYear ?? null,
      max_year: input.extract?.maxYear ?? null,
    });
  }

  let { data, error } = await search(includeGenres);
  if (!error && includeGenres && !(data ?? []).length) {
    ({ data, error } = await search(null));
  }

  if (error) {
    throw new ConfigError(
      `Search failed: ${error.message}`,
      "SEARCH_FAILED",
      "Confirm migrations ran (`npx supabase db reset` or `npx supabase migration up`)."
    );
  }

  const rows = (data ?? []) as MatchRow[];
  if (rows.length === 0) {
    throw new ConfigError(
      "No titles matched after filters.",
      "NO_MATCHES",
      "Try fewer constraints, ingest more pages, or skip dislikes.",
      404
    );
  }

  return llmPick(rows, queryText, input.extract);
}
