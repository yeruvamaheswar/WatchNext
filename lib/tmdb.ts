import { requireTmdb } from "@/lib/env";
import type { TitleCard } from "@/lib/types";

const BASE = "https://api.themoviedb.org/3";

export const MOVIE_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export const TV_GENRES: Record<number, string> = {
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  10765: "Sci-Fi & Fantasy",
  10763: "News",
  10764: "Reality",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western",
  9648: "Mystery",
};

export type TmdbTitle = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  name: string;
  year: number | null;
  overview: string;
  tagline: string;
  genres: string[];
  keywords: string[];
  topCast: string[];
  directors: string[];
  creators: string[];
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number | null;
  popularity: number | null;
  runtime: number | null;
  originalLanguage: string | null;
};

async function tmdbFetch<T>(path: string, query: Record<string, string> = {}) {
  const key = requireTmdb();
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TMDB ${path} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

type ListItem = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  genre_ids?: number[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
};

export async function fetchPopular(mediaType: "movie" | "tv", page: number) {
  const path = mediaType === "movie" ? "/movie/popular" : "/tv/popular";
  const data = await tmdbFetch<{ results: ListItem[] }>(path, {
    page: String(page),
    language: "en-US",
  });
  const genreMap = mediaType === "movie" ? MOVIE_GENRES : TV_GENRES;
  return (data.results ?? []).map((item) => ({
    tmdbId: item.id,
    mediaType,
    name: (mediaType === "movie" ? item.title : item.name) || "Untitled",
    year: yearOf(mediaType === "movie" ? item.release_date : item.first_air_date),
    overview: item.overview ?? "",
    tagline: "",
    genres: (item.genre_ids ?? []).map((id) => genreMap[id]).filter(Boolean),
    keywords: [] as string[],
    topCast: [] as string[],
    directors: [] as string[],
    creators: [] as string[],
    posterPath: item.poster_path ?? null,
    backdropPath: item.backdrop_path ?? null,
    voteAverage: item.vote_average ?? null,
    popularity: item.popularity ?? null,
    runtime: null as number | null,
    originalLanguage: item.original_language ?? null,
  })) satisfies TmdbTitle[];
}

export async function enrichTitle(title: TmdbTitle): Promise<TmdbTitle> {
  const path =
    title.mediaType === "movie"
      ? `/movie/${title.tmdbId}`
      : `/tv/${title.tmdbId}`;
  const data = await tmdbFetch<{
    overview?: string;
    tagline?: string;
    genres?: { name: string }[];
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    popularity?: number;
    runtime?: number;
    episode_run_time?: number[];
    original_language?: string;
    release_date?: string;
    first_air_date?: string;
    keywords?: { keywords?: { name: string }[]; results?: { name: string }[] };
    created_by?: { name: string }[];
    credits?: {
      cast?: { name: string }[];
      crew?: { name: string; job?: string }[];
    };
  }>(path, { append_to_response: "keywords,credits", language: "en-US" });

  const keywordBlock = data.keywords?.keywords ?? data.keywords?.results ?? [];
  return {
    ...title,
    overview: data.overview || title.overview,
    tagline: data.tagline || title.tagline,
    genres: (data.genres ?? []).map((g) => g.name).filter(Boolean) || title.genres,
    keywords: keywordBlock.map((k) => k.name).filter(Boolean).slice(0, 12),
    topCast: uniqueNames(
      (data.credits?.cast ?? []).map((c) => c.name),
      8
    ),
    directors: uniqueNames(
      (data.credits?.crew ?? [])
        .filter((c) => c.job === "Director" || c.job === "Co-Director")
        .map((c) => c.name),
      2
    ),
    creators: uniqueNames(
      (data.created_by ?? []).map((c) => c.name),
      2
    ),
    posterPath: data.poster_path ?? title.posterPath,
    backdropPath: data.backdrop_path ?? title.backdropPath,
    voteAverage: data.vote_average ?? title.voteAverage,
    popularity: data.popularity ?? title.popularity,
    runtime: data.runtime ?? data.episode_run_time?.[0] ?? null,
    originalLanguage: data.original_language ?? title.originalLanguage,
    year:
      yearOf(data.release_date || data.first_air_date) ?? title.year,
  };
}

function yearOf(date?: string | null) {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

export function toTitleCard(title: TmdbTitle): TitleCard {
  return {
    tmdbId: title.tmdbId,
    mediaType: title.mediaType,
    name: title.name,
    year: title.year,
    overview: title.overview,
    genres: title.genres,
    posterPath: title.posterPath,
    backdropPath: title.backdropPath,
    voteAverage: title.voteAverage,
    tagline: title.tagline,
    topCast: title.topCast,
    directors: title.directors,
    creators: title.creators,
  };
}

function uniqueNames(names: Array<string | undefined>, limit: number) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

export function cardsWithPosters(cards: TitleCard[]): TitleCard[] {
  return cards.filter((card) => Boolean(card.posterPath));
}

export async function fetchOnboardingPool() {
  const [movies, shows] = await Promise.all([
    fetchPopular("movie", 1),
    fetchPopular("tv", 1),
  ]);
  return {
    movies: cardsWithPosters(movies.map(toTitleCard)),
    shows: cardsWithPosters(shows.map(toTitleCard)),
  };
}

export async function fetchPosterPath(
  mediaType: "movie" | "tv",
  tmdbId: number
): Promise<string | null> {
  const path = mediaType === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const data = await tmdbFetch<{ poster_path?: string | null }>(path, {
    language: "en-US",
  });
  return data.poster_path ?? null;
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
) {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return out;
}
