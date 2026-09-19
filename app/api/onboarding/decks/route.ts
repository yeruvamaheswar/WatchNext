import {
  FALLBACK_MOVIES,
  FALLBACK_SHOWS,
  ONBOARDING_DECK_SIZE,
  sampleOnboardingDeck,
  VIBE_CARDS,
} from "@/lib/onboarding-catalog";
import { getServerEnv } from "@/lib/env";
import { cardsWithPosters, fetchOnboardingPool } from "@/lib/tmdb";
import { tryCreateAdminSupabase } from "@/lib/supabase/admin";
import { supabaseFetchTimeoutMs } from "@/lib/supabase/timeout";
import { withTimeout } from "@/lib/with-timeout";
import type { TitleCard } from "@/lib/types";

export const dynamic = "force-dynamic";

const POOL_SIZE = 24;

function mapRow(row: {
  tmdb_id: number;
  media_type: "movie" | "tv";
  name: string;
  year: number | null;
  overview: string | null;
  genres: string[] | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number | null;
}): TitleCard {
  return {
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    name: row.name,
    year: row.year,
    overview: row.overview ?? "",
    genres: row.genres ?? [],
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    voteAverage: row.vote_average,
  };
}

function parseIds(value: string | null) {
  if (!value) return new Set<number>();
  return new Set(
    value
      .split(",")
      .map((part) => Number(part))
      .filter((id) => Number.isFinite(id))
  );
}

function parseTokens(value: string | null) {
  if (!value) return new Set<string>();
  return new Set(value.split(",").map((part) => part.trim()).filter(Boolean));
}

function sampleTitles(pool: TitleCard[], excluded: Set<number>) {
  return sampleOnboardingDeck(
    cardsWithPosters(pool),
    ONBOARDING_DECK_SIZE,
    (card) => excluded.has(card.tmdbId)
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const excludeMovies = parseIds(url.searchParams.get("excludeMovies"));
  const excludeShows = parseIds(url.searchParams.get("excludeShows"));
  const excludeVibes = parseTokens(url.searchParams.get("excludeVibes"));

  let moviePool = FALLBACK_MOVIES;
  let showPool = FALLBACK_SHOWS;
  const tmdbKey = getServerEnv().tmdbKey;

  if (tmdbKey) {
    try {
      const live = await withTimeout(fetchOnboardingPool(), 6000);
      if (live.movies.length) moviePool = live.movies;
      if (live.shows.length) showPool = live.shows;
    } catch {
      // Prefer the local catalog, then static TMDB-backed fallbacks.
    }
  }

  const supabase = tryCreateAdminSupabase();
  if (supabase && (!tmdbKey || moviePool === FALLBACK_MOVIES)) {
    try {
      const [movieResult, showResult] = await withTimeout(
        Promise.all([
          supabase
            .from("titles")
            .select(
              "tmdb_id, media_type, name, year, overview, genres, poster_path, backdrop_path, vote_average"
            )
            .eq("media_type", "movie")
            .not("poster_path", "is", null)
            .order("popularity", { ascending: false })
            .limit(POOL_SIZE),
          supabase
            .from("titles")
            .select(
              "tmdb_id, media_type, name, year, overview, genres, poster_path, backdrop_path, vote_average"
            )
            .eq("media_type", "tv")
            .not("poster_path", "is", null)
            .order("popularity", { ascending: false })
            .limit(POOL_SIZE),
        ]),
        supabaseFetchTimeoutMs(getServerEnv().supabaseUrl)
      );
      if (movieResult.data?.length) moviePool = movieResult.data.map(mapRow);
      if (showResult.data?.length) showPool = showResult.data.map(mapRow);
    } catch {
      // Static fallback decks — onboarding works without a live database.
    }
  }

  return Response.json({
    movies: sampleTitles(moviePool, excludeMovies),
    shows: sampleTitles(showPool, excludeShows),
    vibes: sampleOnboardingDeck(
      VIBE_CARDS,
      ONBOARDING_DECK_SIZE,
      (vibe) => excludeVibes.has(vibe.id)
    ),
    source: tmdbKey ? "tmdb" : "static",
  });
}
