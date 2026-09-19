import { FALLBACK_MOVIES, FALLBACK_SHOWS, VIBE_CARDS } from "@/lib/onboarding-catalog";
import { tryCreateAdminSupabase } from "@/lib/supabase/admin";
import { withTimeout } from "@/lib/with-timeout";
import type { TitleCard } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const supabase = tryCreateAdminSupabase();
  let movies = FALLBACK_MOVIES;
  let shows = FALLBACK_SHOWS;

  if (supabase) {
    try {
      const [movieResult, showResult] = await withTimeout(
        Promise.all([
          supabase
            .from("titles")
            .select(
              "tmdb_id, media_type, name, year, overview, genres, poster_path, backdrop_path, vote_average"
            )
            .eq("media_type", "movie")
            .order("popularity", { ascending: false })
            .limit(12),
          supabase
            .from("titles")
            .select(
              "tmdb_id, media_type, name, year, overview, genres, poster_path, backdrop_path, vote_average"
            )
            .eq("media_type", "tv")
            .order("popularity", { ascending: false })
            .limit(12),
        ]),
        2000
      );
      if (movieResult.data?.length) movies = movieResult.data.map(mapRow);
      if (showResult.data?.length) shows = showResult.data.map(mapRow);
    } catch {
      // Static fallback decks — onboarding works without a live database.
    }
  }

  return Response.json({ movies, shows, vibes: VIBE_CARDS });
}
