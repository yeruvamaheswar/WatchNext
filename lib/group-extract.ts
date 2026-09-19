import {
  emptyIntent,
  heuristicIntent,
  normalizeExtractedIntent,
} from "@/lib/intent-heuristic";
import { labeledTranscriptFromSegments } from "@/lib/diarize";
import { getOpenAI, openaiModels } from "@/lib/openai";
import type {
  DiarizedSegment,
  ExtractedIntent,
  GroupExtractResult,
} from "@/lib/types";

/**
 * Build group watch intent from a Person-labeled discussion.
 * Finds overlap and compromises — not one loud voice.
 */
export async function extractGroupIntent(
  segments: DiarizedSegment[]
): Promise<GroupExtractResult> {
  const labeledTranscript = labeledTranscriptFromSegments(segments);
  if (!labeledTranscript.trim()) {
    return {
      extract: emptyIntent(),
      speakerNotes: {},
      labeledTranscript: "",
    };
  }

  const openai = getOpenAI();
  const { chat } = openaiModels();
  try {
    const completion = await openai.chat.completions.create({
      model: chat,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You analyze a group watch-night discussion. Speakers are labeled Person 1, Person 2, etc.
Return JSON with:
- titles, people, moods, genres, constraints (string[]),
- watchIntent (boolean), searchQuery (short embedding string for the GROUP compromise),
- mediaType ("movie"|"tv"|"any"|null), minYear (number|null), maxYear (number|null),
- excludeGenres (string[]),
- speakerNotes (object mapping each Person N to one short preference line).
Prefer overlap and compromises in searchQuery. Do not let one loud person dominate.
genres must be TMDB genre names — never movie, tv, film, or show.`,
        },
        {
          role: "user",
          content: labeledTranscript,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ExtractedIntent> & {
      speakerNotes?: Record<string, string>;
    };
    const speakerNotes = Object.fromEntries(
      Object.entries(parsed.speakerNotes ?? {})
        .map(([k, v]) => [k, String(v ?? "").trim()] as const)
        .filter(([, v]) => v)
    );

    const base = emptyIntent();
    const extract = normalizeExtractedIntent({
      ...base,
      ...parsed,
      titles: parsed.titles ?? [],
      people: parsed.people ?? [],
      moods: parsed.moods ?? [],
      genres: parsed.genres ?? [],
      constraints: parsed.constraints ?? [],
      excludeGenres: parsed.excludeGenres ?? [],
      watchIntent: true,
      searchQuery: parsed.searchQuery?.trim() || labeledTranscript.slice(0, 400),
      mediaType: parsed.mediaType ?? null,
      minYear: parsed.minYear ?? null,
      maxYear: parsed.maxYear ?? null,
    });

    const notes =
      Object.keys(speakerNotes).length > 0
        ? speakerNotes
        : fallbackSpeakerNotes(segments);

    return { extract, speakerNotes: notes, labeledTranscript };
  } catch {
    const extract = {
      ...heuristicIntent(labeledTranscript),
      watchIntent: true,
    };
    return {
      extract,
      speakerNotes: fallbackSpeakerNotes(segments),
      labeledTranscript,
    };
  }
}

function fallbackSpeakerNotes(segments: DiarizedSegment[]) {
  const notes: Record<string, string> = {};
  for (const seg of segments) {
    if (!notes[seg.speaker]) notes[seg.speaker] = seg.text.slice(0, 80);
  }
  return notes;
}
