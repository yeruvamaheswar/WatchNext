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
import { ERA_PACK } from "./era-pack";
import {
  enrichTitle,
  fetchPopular,
  mapPool,
  searchTitle,
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
function takeLimit(
  titles: TmdbTitle[],
  limit: number | null,
  media: "movie" | "tv" | "all"
) {
  if (!limit) return titles;
  if (media !== "all") return titles.slice(0, limit);
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

function parsePackArg() {
  const idx = process.argv.indexOf("--pack");
  if (idx < 0 || !process.argv[idx + 1]) return null;
  const raw = String(process.argv[idx + 1]).toLowerCase().trim();
  return raw === "era" ? "era" : null;
}

async function resolveEraPack() {
  const resolved: TmdbTitle[] = [];
  const seen = new Set<string>();
  const queries: typeof ERA_PACK = [];
  const queryKeys = new Set<string>();
  for (const pick of ERA_PACK) {
    const key = `${pick.mediaType}:${pick.query.toLowerCase()}:${pick.year ?? ""}`;
    if (queryKeys.has(key)) continue;
    queryKeys.add(key);
    queries.push(pick);
  }
  let missed = 0;
  for (const [i, pick] of queries.entries()) {
    try {
      const title = await searchTitle(pick.mediaType, pick.query, pick.year);
      if (!title) {
        missed += 1;
        console.warn(`  miss: ${pick.query} (${pick.mediaType}${pick.year ? ` ${pick.year}` : ""})`);
        continue;
      }
      const key = `${title.mediaType}:${title.tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push(title);
    } catch (err) {
      missed += 1;
      console.warn(
        `  miss: ${pick.query}:`,
        err instanceof Error ? err.message : err
      );
    }
    if ((i + 1) % 40 === 0) {
      console.log(`  resolved ${resolved.length} unique / ${i + 1} queries`);
    }
  }
  if (missed) console.log(`  ${missed} searches found nothing`);
  return resolved;
}

function parseMediaArg(): "movie" | "tv" | "all" {
  const idx = process.argv.indexOf("--media");
  if (idx < 0 || !process.argv[idx + 1]) return "all";
  const raw = String(process.argv[idx + 1]).toLowerCase().trim();
  if (raw === "movie" || raw === "tv" || raw === "all") return raw;
  return "all";
}

function parseExcludeGenres() {
  const idx = process.argv.indexOf("--exclude-genres");
  if (idx < 0 || !process.argv[idx + 1]) return [];
  return String(process.argv[idx + 1])
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/** Anime, not Western animation: Japanese + Animation, or an explicit anime tag. */
function isAnime(title: TmdbTitle) {
  const genres = (title.genres ?? []).map((g) => g.toLowerCase());
  const keywords = (title.keywords ?? []).map((k) => k.toLowerCase());
  if (
    genres.includes("anime") ||
    keywords.some((k) => k === "anime" || k.includes("anime"))
  ) {
    return true;
  }
  return genres.includes("animation") && title.originalLanguage === "ja";
}

function shouldSkipTitle(
  title: TmdbTitle,
  excludeAnime: boolean,
  excludeGenres: string[]
) {
  if (excludeAnime && isAnime(title)) return true;
  if (!excludeGenres.length) return false;
  return (title.genres ?? []).some((g) =>
    excludeGenres.includes(g.toLowerCase())
  );
}

async function loadExistingKeys(
  supabase: ReturnType<typeof createIngestSupabase>,
  media: "movie" | "tv" | "all"
) {
  const keys = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase
      .from("titles")
      .select("tmdb_id, media_type")
      .range(from, from + pageSize - 1);
    if (media !== "all") query = query.eq("media_type", media);
    const { data, error } = await query;
    if (error) throw new Error(`Failed loading existing titles: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) keys.add(`${row.media_type}:${row.tmdb_id}`);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return keys;
}

async function loadCatalogTitles(
  supabase: ReturnType<typeof createIngestSupabase>,
  media: "movie" | "tv" | "all"
) {
  const titles: TmdbTitle[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase
      .from("titles")
      .select(
        "tmdb_id, media_type, name, year, overview, tagline, genres, keywords, top_cast, directors, creators, poster_path, backdrop_path, vote_average, popularity, runtime, original_language"
      )
      .range(from, from + pageSize - 1);
    if (media !== "all") query = query.eq("media_type", media);
    const { data, error } = await query;
    if (error) throw new Error(`Failed loading catalog titles: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      titles.push({
        tmdbId: row.tmdb_id,
        mediaType: row.media_type,
        name: row.name,
        year: row.year,
        overview: row.overview ?? "",
        tagline: row.tagline ?? "",
        genres: row.genres ?? [],
        keywords: row.keywords ?? [],
        topCast: row.top_cast ?? [],
        directors: row.directors ?? [],
        creators: row.creators ?? [],
        posterPath: row.poster_path,
        backdropPath: row.backdrop_path,
        voteAverage: row.vote_average,
        popularity: row.popularity,
        runtime: row.runtime,
        originalLanguage: row.original_language,
      });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return titles;
}

async function main() {
  requireTmdb();
  requireOpenAI();
  const limit = optionalArgValue("--limit");
  const media = parseMediaArg();
  const pack = parsePackArg();
  const newOnly = process.argv.includes("--new-only");
  const refresh = process.argv.includes("--refresh");
  const excludeAnime = process.argv.includes("--exclude-anime");
  const excludeGenres = parseExcludeGenres();
  const mediaTypes =
    media === "all" ? (["movie", "tv"] as const) : ([media] as const);
  const filling = Boolean(
    limit && (newOnly || excludeAnime || excludeGenres.length > 0)
  );
  // With filters / --new-only + --limit, keep paging until we fill the quota.
  const defaultPages = limit && !filling ? 1 : getServerEnv().ingestPages;
  const pages = Math.min(500, argValue("--pages", filling ? 50 : defaultPages));
  const skipEnrich = process.argv.includes("--quick");
  const filterBits = [
    excludeAnime ? "no anime" : "",
    excludeGenres.length ? `exclude-genres ${excludeGenres.join(",")}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  console.log(
    pack
      ? `WatchNext ingest: ${pack} pack${limit ? `, limit ${limit}` : ""}${
          newOnly ? ", new-only" : ""
        }${skipEnrich ? " (quick, no keywords/cast)" : ""}.`
      : refresh
      ? `WatchNext ingest: refresh existing catalog${
          media !== "all" ? ` (${media})` : ""
        }${skipEnrich ? " (quick, no keywords/cast)" : ""}.`
      : `WatchNext ingest: up to ${pages} TMDB pages of ${mediaTypes.join(" + ")}${
          limit ? `, limit ${limit}` : ""
        }${newOnly ? ", new-only" : ""}${filterBits ? `, ${filterBits}` : ""}${
          skipEnrich ? " (quick, no keywords/cast)" : ""
        }.`
  );
  console.log(
    `Using ${aliasSources.openaiSource} and ${aliasSources.tmdbSource} (values not logged).`
  );

  const supabase = createIngestSupabase();
  if (pack === "era") {
    console.log(`Resolving ${ERA_PACK.length} era-pack searches…`);
    const resolved = await resolveEraPack();
    const existing = newOnly ? await loadExistingKeys(supabase, "all") : new Set<string>();
    const fresh = resolved.filter(
      (title) => !existing.has(`${title.mediaType}:${title.tmdbId}`)
    );
    const unique = takeLimit(fresh, limit, "all");
    console.log(
      `Era pack: ${resolved.length} resolved, ${fresh.length} new, ingesting ${unique.length}.`
    );
    if (unique.length === 0) {
      console.log("Nothing new to ingest.");
      return;
    }
    await upsertAndEmbed(supabase, unique, skipEnrich, "all", limit);
    return;
  }
  if (refresh) {
    const catalog = await loadCatalogTitles(supabase, media);
    const unique = takeLimit(catalog, limit, media);
    console.log(`Unique titles to refresh: ${unique.length}`);
    if (unique.length === 0) {
      console.log("Nothing to refresh.");
      return;
    }
    await upsertAndEmbed(supabase, unique, skipEnrich, media, limit);
    return;
  }

  const existing = newOnly ? await loadExistingKeys(supabase, media) : new Set<string>();
  if (newOnly) console.log(`Existing in DB (scope=${media}): ${existing.size}`);

  const collected: TmdbTitle[] = [];
  const seen = new Set<string>();
  const skipped = { anime: 0, genre: 0 };
  const collectLimit =
    limit && (excludeAnime || excludeGenres.length)
      ? Math.ceil(limit * 1.12)
      : limit;
  const movieTarget =
    media === "all" && collectLimit ? Math.ceil(collectLimit / 2) : collectLimit;
  const tvTarget =
    media === "all" && collectLimit
      ? collectLimit - Math.ceil(collectLimit / 2)
      : collectLimit;
  const countOf = (mediaType: "movie" | "tv") =>
    collected.filter((title) => title.mediaType === mediaType).length;
  const typeTarget = (mediaType: "movie" | "tv") =>
    mediaType === "movie" ? movieTarget : tvTarget;
  const filled = () =>
    mediaTypes.every(
      (mediaType) => !typeTarget(mediaType) || countOf(mediaType) >= typeTarget(mediaType)!
    );

  for (let page = 1; page <= pages && !filled(); page++) {
    for (const mediaType of mediaTypes) {
      const target = typeTarget(mediaType);
      if (target && countOf(mediaType) >= target) continue;
      const batch = await fetchPopular(mediaType, page);
      let added = 0;
      for (const title of batch) {
        const key = `${title.mediaType}:${title.tmdbId}`;
        if (seen.has(key)) continue;
        if (newOnly && existing.has(key)) continue;
        if (shouldSkipTitle(title, excludeAnime, excludeGenres)) {
          seen.add(key);
          if (excludeAnime && isAnime(title)) skipped.anime += 1;
          else skipped.genre += 1;
          continue;
        }
        seen.add(key);
        collected.push(title);
        added++;
        if (target && countOf(mediaType) >= target) break;
      }
      console.log(
        `  ${mediaType} page ${page}: ${batch.length} fetched, ${added} kept (pool ${collected.length})`
      );
      if (batch.length === 0 && mediaTypes.length === 1) break;
    }
  }
  if (skipped.anime || skipped.genre) {
    console.log(
      `  skipped ${skipped.anime} anime, ${skipped.genre} excluded-genre titles`
    );
  }

  const unique = takeLimit(collected, collectLimit, media);
  console.log(`Unique titles to ingest: ${unique.length}`);
  if (unique.length === 0) {
    console.log("Nothing new to ingest.");
    return;
  }

  await upsertAndEmbed(supabase, unique, skipEnrich, media, limit, {
    excludeAnime,
    excludeGenres,
    skipped,
  });
}

async function upsertAndEmbed(
  supabase: ReturnType<typeof createIngestSupabase>,
  unique: TmdbTitle[],
  skipEnrich: boolean,
  media: "movie" | "tv" | "all",
  limit: number | null,
  filters?: {
    excludeAnime: boolean;
    excludeGenres: string[];
    skipped: { anime: number; genre: number };
  }
) {
  const enrichedRaw = skipEnrich
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
  const excludeAnime = filters?.excludeAnime ?? false;
  const excludeGenres = filters?.excludeGenres ?? [];
  const skipped = filters?.skipped ?? { anime: 0, genre: 0 };
  const enriched = takeLimit(
    enrichedRaw.filter((title) => {
      if (!shouldSkipTitle(title, excludeAnime, excludeGenres)) return true;
      if (excludeAnime && isAnime(title)) skipped.anime += 1;
      else skipped.genre += 1;
      return false;
    }),
    limit,
    media
  );
  if (enriched.length !== unique.length) {
    console.log(
      `  after enrich filters: ${enriched.length} titles (dropped ${
        unique.length - enriched.length
      })`
    );
  }

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
    directors: t.directors,
    creators: t.creators,
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

  const wanted = new Set(enriched.map((t) => `${t.mediaType}:${t.tmdbId}`));
  const { data: storedAll, error: storedError } = await supabase
    .from("titles")
    .select(
      "id, tmdb_id, media_type, name, year, overview, tagline, genres, keywords, top_cast, directors, creators"
    )
    .in(
      "tmdb_id",
      enriched.map((t) => t.tmdbId)
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
      directors: row.directors ?? [],
      creators: row.creators ?? [],
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
