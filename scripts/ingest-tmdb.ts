import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { embedTexts, titleEmbedText } from "../lib/embeddings";
import {
  applyGitHubEnvAliases,
  getServerEnv,
  requireOpenAI,
  requireSupabaseAdmin,
  requireTmdb,
} from "../lib/env";
import { openaiModels } from "../lib/openai";
import { timedFetch } from "../lib/timed-fetch";
import {
  enrichTitle,
  fetchPopular,
  mapPool,
  type TmdbTitle,
} from "../lib/tmdb";

/** Hosted upserts of embeddings need more than the app’s 2.5s UI timeout. */
function createIngestSupabase() {
  const env = requireSupabaseAdmin();
  const key = env.supabaseService || env.supabaseAnon;
  return createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { retry: false },
    global: { fetch: timedFetch(60_000) },
  });
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");
const aliasSources = applyGitHubEnvAliases();

function argValue(flag: string, fallback: number) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) {
    return Number(process.argv[idx + 1]) || fallback;
  }
  return fallback;
}

function optionalArgValue(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) {
    const n = Number(process.argv[idx + 1]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }
  return null;
}

/** Mix movies + TV so a small --limit is not all one media type. */
function takeLimit(titles: TmdbTitle[], limit: number | null) {
  if (!limit) return titles;
  const movies = titles.filter((t) => t.mediaType === "movie");
  const tv = titles.filter((t) => t.mediaType === "tv");
  const movieN = Math.min(movies.length, Math.ceil(limit / 2));
  const tvN = Math.min(tv.length, limit - movieN);
  const picked = [...movies.slice(0, movieN), ...tv.slice(0, tvN)];
  if (picked.length >= limit) return picked.slice(0, limit);
  const seen = new Set(picked.map((t) => `${t.mediaType}:${t.tmdbId}`));
  for (const t of titles) {
    if (picked.length >= limit) break;
    const key = `${t.mediaType}:${t.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(t);
  }
  return picked.slice(0, limit);
}

async function main() {
  requireTmdb();
  requireOpenAI();
  const limit = optionalArgValue("--limit");
  const pages = argValue("--pages", limit ? 1 : getServerEnv().ingestPages);
  const skipEnrich = process.argv.includes("--quick");
  console.log(
    `WatchNext ingest: ${pages} TMDB pages each of movies + TV${
      limit ? `, limit ${limit}` : ""
    }${skipEnrich ? " (quick, no keywords/cast)" : ""}.`
  );
  console.log(
    `Using ${aliasSources.openaiSource} and ${aliasSources.tmdbSource} (values not logged).`
  );

  const collected: TmdbTitle[] = [];
  for (const mediaType of ["movie", "tv"] as const) {
    for (let page = 1; page <= pages; page++) {
      const batch = await fetchPopular(mediaType, page);
      collected.push(...batch);
      console.log(`  ${mediaType} page ${page}: ${batch.length} titles`);
    }
  }

  const unique = takeLimit(
    [
      ...new Map(
        collected.map((t) => [`${t.mediaType}:${t.tmdbId}`, t] as const)
      ).values(),
    ],
    limit
  );
  console.log(`Unique titles: ${unique.length}`);

  const enriched = skipEnrich
    ? unique
    : await mapPool(unique, 4, async (title, i) => {
        try {
          const next = await enrichTitle(title);
          if ((i + 1) % 25 === 0) {
            console.log(`  enriched ${i + 1}/${unique.length}`);
          }
          return next;
        } catch (err) {
          console.warn(`  skip enrich ${title.name}:`, (err as Error).message);
          return title;
        }
      });

  const supabase = createIngestSupabase();
  const upserts = enriched.map((t) => ({
    tmdb_id: t.tmdbId,
    media_type: t.mediaType,
    name: t.name,
    year: t.year,
    overview: t.overview,
    tagline: t.tagline,
    genres: t.genres,
    keywords: t.keywords,
    top_cast: t.topCast,
    poster_path: t.posterPath,
    backdrop_path: t.backdropPath,
    vote_average: t.voteAverage,
    popularity: t.popularity,
    runtime: t.runtime,
    original_language: t.originalLanguage,
  }));

  for (let i = 0; i < upserts.length; i += 100) {
    const slice = upserts.slice(i, i + 100);
    const { error } = await supabase
      .from("titles")
      .upsert(slice, { onConflict: "tmdb_id,media_type" });
    if (error) throw new Error(`Title upsert failed: ${error.message}`);
    console.log(`  upserted titles ${Math.min(i + 100, upserts.length)}/${upserts.length}`);
  }

  const wanted = new Set(unique.map((t) => `${t.mediaType}:${t.tmdbId}`));
  const { data: storedAll, error: storedError } = await supabase
    .from("titles")
    .select(
      "id, tmdb_id, media_type, name, year, overview, tagline, genres, keywords, top_cast"
    )
    .in(
      "tmdb_id",
      unique.map((t) => t.tmdbId)
    );
  if (storedError) throw new Error(storedError.message);
  const stored = (storedAll ?? []).filter((row) =>
    wanted.has(`${row.media_type}:${row.tmdb_id}`)
  );

  const texts = stored.map((row) =>
    titleEmbedText({
      name: row.name,
      year: row.year,
      overview: row.overview,
      tagline: row.tagline,
      genres: row.genres ?? [],
      keywords: row.keywords ?? [],
      topCast: row.top_cast ?? [],
      mediaType: row.media_type,
    })
  );

  console.log(`Embedding ${texts.length} titles…`);
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const slice = texts.slice(i, i + 64);
    const vectors = await embedTexts(slice);
    embeddings.push(...vectors);
    console.log(`  embedded ${Math.min(i + 64, texts.length)}/${texts.length}`);
  }

  const model = openaiModels().embedding;

  const embedRows = stored.map((row, i) => ({
    title_id: row.id,
    embedding: embeddings[i],
    model,
  }));

  for (let i = 0; i < embedRows.length; i += 50) {
    const slice = embedRows.slice(i, i + 50);
    const { error } = await supabase
      .from("title_embeddings")
      .upsert(slice, { onConflict: "title_id" });
    if (error) throw new Error(`Embedding upsert failed: ${error.message}`);
    console.log(
      `  upserted embeddings ${Math.min(i + 50, embedRows.length)}/${embedRows.length}`
    );
  }

  const { count: titleCount } = await supabase
    .from("titles")
    .select("id", { count: "exact", head: true });
  const { count: embedCount } = await supabase
    .from("title_embeddings")
    .select("title_id", { count: "exact", head: true });
  console.log(
    `Ingest complete. titles=${titleCount ?? 0} embeddings=${embedCount ?? 0} model=${model}`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  if (err && typeof err === "object" && "hint" in err) {
    console.error((err as { hint?: string }).hint);
  }
  process.exit(1);
});
