import type { DiarizedSegment, DiarizedTranscript } from "@/lib/types";

type RawSegment = {
  speaker?: string;
  start?: number;
  end?: number;
  text?: string;
  type?: string;
};

/** Map model speaker labels (A, B, SPEAKER_1, …) to Person 1, Person 2, … by first appearance. */
export function mapSpeakersToPersons(raw: RawSegment[]): DiarizedSegment[] {
  const order = new Map<string, string>();
  let next = 1;
  const segments: DiarizedSegment[] = [];

  for (const seg of raw) {
    const text = String(seg.text ?? "").trim();
    if (!text) continue;
    const rawSpeaker = String(seg.speaker ?? "unknown").trim() || "unknown";
    let person = order.get(rawSpeaker);
    if (!person) {
      person = `Person ${next++}`;
      order.set(rawSpeaker, person);
    }
    segments.push({
      speaker: person,
      start: typeof seg.start === "number" ? seg.start : 0,
      end: typeof seg.end === "number" ? seg.end : 0,
      text,
    });
  }
  return segments;
}

export function labeledTranscriptFromSegments(segments: DiarizedSegment[]): string {
  return segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
}

export function normalizeDiarizedResponse(payload: {
  text?: string;
  segments?: RawSegment[];
}): DiarizedTranscript {
  const segments = mapSpeakersToPersons(payload.segments ?? []);
  const text =
    labeledTranscriptFromSegments(segments) ||
    String(payload.text ?? "").trim();
  return { text, segments };
}
