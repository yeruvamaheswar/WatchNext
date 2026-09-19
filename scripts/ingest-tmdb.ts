import { existsSync, readFileSync } from "node:fs";
import { embedTexts, titleEmbedText } from "../lib/embeddings";
import { getServerEnv, requireOpenAI, requireTmdb } from "../lib/env";
import { createAdminSupabase } from "../lib/supabase/admin";
import {
  enrichTitle,
  fetchPopular,
  mapPool,
  type TmdbTitle,
} from "../lib/tmdb";

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

function argValue(flag: string, fallback: number) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) {
    return Number(process.argv[idx + 1]) || fallback;
  }
  return fallback;
}

async function main() {
  requireTmdb();
  requireOpenAI();
  const pages = argValue("--pages", getServerEnv().ingestPages);
  const skipEnrich = process.argv.includes("--quick");
  console.log(
    `WatchNext ingest: ${pages} TMDB pages each of movies + TV${skipEnrich ? " (quick, no keywords/cast)" : ""}.`
  );

  const collected: TmdbTitle[] = [];
  for (const mediaType of ["movie", "tv"] as const) {
    for (let page = 1; page <= pages; page++) {
      const batch = await fetchPopular(mediaType, page);
      collected.push(...batch);
      console.log(`  ${mediaType} page ${page}: ${batch.length} titles`);
    }
  }

  const unique = [
    ...new Map(collected.map((t) => [`${t.mediaType}:${t.tmdbId}`, t])).values(),
  ];
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

  const supabase = createAdminSupabase();
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

  const { data: stored, error: storedError } = await supabase
    .from("titles")
    .select(
      "id, tmdb_id, media_type, name, year, overview, tagline, genres, keywords, top_cast"
    );
  if (storedError) throw new Error(storedError.message);

  const texts = (stored ?? []).map((row) =>
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

  const { data: modelRow } = await supabase
    .from("title_embeddings")
    .select("model")
    .limit(1)
    .maybeSingle();
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  const embedRows = (stored ?? []).map((row, i) => ({
    title_id: row.id,
    embedding: embeddings[i],
    model: modelRow?.model || model,
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

  console.log("Ingest complete.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  if (err && typeof err === "object" && "hint" in err) {
    console.error((err as { hint?: string }).hint);
  }
  process.exit(1);
});
