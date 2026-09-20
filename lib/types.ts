export type MediaType = "movie" | "tv";
export type Verdict = "like" | "dislike";
export type LikeSource = "onboarding" | "favorite";

export type TitleCard = {
  tmdbId: number;
  mediaType: MediaType;
  name: string;
  year: number | null;
  overview: string;
  genres: string[];
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number | null;
  tagline?: string | null;
  topCast?: string[];
  directors?: string[];
  creators?: string[];
};

export type VibeCard = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  backdropPath?: string | null;
};

export type GuestLike = {
  tmdbId: number;
  mediaType: MediaType;
  verdict: Verdict;
  source: LikeSource;
  name?: string;
};

export type TitleMark = {
  tmdbId: number;
  mediaType: MediaType;
  name?: string;
};

export type SeenOnboarding = {
  movieIds: number[];
  showIds: number[];
  vibeIds: string[];
};

export type GuestState = {
  guestId: string;
  displayName: string;
  onboardingComplete: boolean;
  likes: GuestLike[];
  likedVibes: string[];
  dislikedVibes: string[];
  seenOnboarding: SeenOnboarding;
  watchlist: TitleMark[];
  seen: TitleMark[];
};

export type ExtractedIntent = {
  titles: string[];
  people: string[];
  moods: string[];
  genres: string[];
  constraints: string[];
  watchIntent: boolean;
  searchQuery: string;
  mediaType: MediaType | "any" | null;
  minYear: number | null;
  maxYear: number | null;
  excludeGenres: string[];
};

export type SuggestedTitle = TitleCard & {
  id: string;
  reason: string;
  distance?: number;
};

export type RecommendResult = {
  titles: SuggestedTitle[];
  spokenPitch: string;
};

export type RecommendInput = {
  queryText?: string;
  extract?: ExtractedIntent | null;
  likes?: GuestLike[];
  likedVibes?: string[];
  dislikedVibes?: string[];
  userId?: string | null;
  excludeTmdbIds?: number[];
  sessionExcludeIds?: number[];
  /** Solo (default) vs group discussion recommend. Live Realtime stays solo. */
  mode?: "solo" | "group";
  /** Person N preference notes from group extract; used only when mode is group. */
  speakerNotes?: Record<string, string>;
};

export type DiarizedSegment = {
  speaker: string;
  start: number;
  end: number;
  text: string;
};

export type DiarizedTranscript = {
  text: string;
  segments: DiarizedSegment[];
};

export type GroupExtractResult = {
  extract: ExtractedIntent;
  speakerNotes: Record<string, string>;
  labeledTranscript: string;
};

export type HealthStatus = {
  ok: boolean;
  openai: boolean;
  tmdb: boolean;
  supabaseConfigured: boolean;
  supabaseReachable: boolean;
  catalogCount: number | null;
  missing: string[];
  hints: string[];
};
