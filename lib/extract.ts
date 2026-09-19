import { getOpenAI, openaiModels } from "@/lib/openai";
import type { ExtractedIntent } from "@/lib/types";

const emptyIntent = (): ExtractedIntent => ({
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

export async function extractIntent(
  transcript: string,
  prior?: string
): Promise<ExtractedIntent> {
  const openai = getOpenAI();
  const { chat } = openaiModels();
  const completion = await openai.chat.completions.create({
    model: chat,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Extract watch-night intent from a spoken transcript. Return JSON with keys:
titles (string[]), people (string[]), moods (string[]), genres (string[]), constraints (string[]),
watchIntent (boolean), searchQuery (short embedding string), mediaType ("movie"|"tv"|"any"|null),
minYear (number|null), maxYear (number|null), excludeGenres (string[]).
watchIntent is true if they asked what to watch, listed enough entities, or clearly want a pick.
genres must be TMDB genre names such as Comedy, Action, Drama — never movie, tv, film, or show (those belong in mediaType).`,
      },
      {
        role: "user",
        content: JSON.stringify({
          priorTranscript: prior ?? "",
          latestUtterance: transcript,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as Partial<ExtractedIntent>;
    const base = emptyIntent();
    return normalizeExtractedIntent({
      ...base,
      ...parsed,
      titles: parsed.titles ?? [],
      people: parsed.people ?? [],
      moods: parsed.moods ?? [],
      genres: parsed.genres ?? [],
      constraints: parsed.constraints ?? [],
      excludeGenres: parsed.excludeGenres ?? [],
      watchIntent: Boolean(parsed.watchIntent),
      searchQuery: parsed.searchQuery ?? transcript,
      mediaType: parsed.mediaType ?? null,
      minYear: parsed.minYear ?? null,
      maxYear: parsed.maxYear ?? null,
    });
  } catch {
    const heuristic = /watch|movie|show|film|something|tonight|recommend/i.test(
      transcript
    );
    return {
      ...emptyIntent(),
      watchIntent: heuristic,
      searchQuery: transcript,
    };
  }
}
