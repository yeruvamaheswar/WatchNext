/** Shared shapes for WatchNext recommendations. Stable for page + future TMDB provider. */

export type CatalogItem = {
  id: string;
  title: string;
  year: number;
  mediaType: "movie" | "tv";
  genres: string[];
  moods: string[];
  overview: string;
  /** Optional external id for a future TMDB-backed provider */
  tmdbId?: number;
};

export type RecommendInput = {
  mood?: string | null;
  genre?: string | null;
  favoritesText?: string | null;
};

export type RankedRecommendation = {
  item: CatalogItem;
  score: number;
  why: string;
};

export type RecommendResult = {
  recommendations: RankedRecommendation[];
  /** Friendly copy when nothing matched or input was empty/invalid */
  message?: string;
  /** Which backend produced this result */
  source: "catalog" | "tmdb";
};

export type RecommendProvider = {
  id: "catalog" | "tmdb";
  recommend: (input: RecommendInput) => Promise<RecommendResult> | RecommendResult;
};
