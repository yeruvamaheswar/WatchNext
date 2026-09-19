import type { ExtractedIntent } from "@/lib/types";

export const emptyIntent = (): ExtractedIntent => ({
  titles: [],
  people: [],
  moods: [],
  genres: [],
  constraints: [],
  watchIntent: false,
  searchQuery: "",
  mediaType: null,
  minYear: null,
  maxYear: null,
  excludeGenres: [],
});

const MEDIA_TOKENS: Record<string, "movie" | "tv"> = {
  movie: "movie",
  movies: "movie",
  film: "movie",
  films: "movie",
  tv: "tv",
  show: "tv",
  shows: "tv",
  series: "tv",
};

const WATCH_HINT =
  /\b(watch|movie|show|film|series|recommend|suggest|tonight|something)\b/i;

const GENRE_HINTS: Array<[RegExp, string]> = [
  [/\b(comed(y|ies)|funny|hilarious|laughs?)\b/i, "Comedy"],
  [/\b(action)\b/i, "Action"],
  [/\b(adventure)\b/i, "Adventure"],
  [/\b(animated|animation|cartoon|pixar|anime)\b/i, "Animation"],
  [/\b(horror|scary|creepy)\b/i, "Horror"],
  [/\b(thriller|suspense)\b/i, "Thriller"],
  [/\b(romance|romantic|romcom|rom-com)\b/i, "Romance"],
  [/\b(drama)\b/i, "Drama"],
  [/\b(sci[- ]?fi|science fiction)\b/i, "Science Fiction"],
  [/\b(fantasy)\b/i, "Fantasy"],
  [/\b(mystery)\b/i, "Mystery"],
  [/\b(crime|heist)\b/i, "Crime"],
  [/\b(family|kids?)\b/i, "Family"],
  [/\b(documentary|docs?)\b/i, "Documentary"],
  [/\b(war)\b/i, "War"],
  [/\b(western)\b/i, "Western"],
];

const MOOD_HINTS: Array<[RegExp, string]> = [
  [/\b(comfort|cozy|feel[- ]good)\b/i, "comfort"],
  [/\b(intense|gripping)\b/i, "intense"],
  [/\b(thoughtful|smart|cerebral)\b/i, "thoughtful"],
  [/\b(mind[- ]bending|twisty)\b/i, "mind-bending"],
  [/\b(light|easy|casual)\b/i, "light"],
];

/** Move movie/tv tokens out of genres so match_titles include_genres still hits TMDB names. */
export function normalizeExtractedIntent(intent: ExtractedIntent): ExtractedIntent {
  let mediaType = intent.mediaType;
  const genres: string[] = [];
  for (const raw of intent.genres ?? []) {
    const key = raw.trim().toLowerCase();
    const mapped = MEDIA_TOKENS[key];
    if (mapped) {
      if (!mediaType || mediaType === "any") mediaType = mapped;
      continue;
    }
    if (raw.trim()) genres.push(raw);
  }
  return { ...intent, genres, mediaType };
}

/** Instant client-side parse so Room can recommend without waiting on /api/extract. */
export function heuristicIntent(transcript: string): ExtractedIntent {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const genres = GENRE_HINTS.filter(([re]) => re.test(text)).map(([, name]) => name);
  const moods = MOOD_HINTS.filter(([re]) => re.test(text)).map(([, name]) => name);
  let mediaType: ExtractedIntent["mediaType"] = null;
  for (const [token, mapped] of Object.entries(MEDIA_TOKENS)) {
    if (new RegExp(`\\b${token}\\b`, "i").test(text)) {
      mediaType = mapped;
      break;
    }
  }
  const excludeGenres: string[] = [];
  if (/\b(not|no|without|skip)\b.*\b(scar|horror)\b/i.test(text) || /\bno horror\b/i.test(lower)) {
    excludeGenres.push("Horror");
  }
  const watchIntent =
    WATCH_HINT.test(text) || genres.length > 0 || moods.length > 0 || text.split(/\s+/).length >= 5;
  return normalizeExtractedIntent({
    ...emptyIntent(),
    genres: [...new Set(genres)],
    moods,
    excludeGenres,
    watchIntent,
    searchQuery: text,
    mediaType,
  });
}

export function shouldAutoSuggest(text: string) {
  return heuristicIntent(text).watchIntent;
}
