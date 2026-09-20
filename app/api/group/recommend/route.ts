import { handleRouteError, jsonError } from "@/lib/errors";
import { requireOpenAI } from "@/lib/env";
import { extractGroupIntent } from "@/lib/group-extract";
import { recommend } from "@/lib/recommend";
import type { DiarizedSegment, GuestLike, RecommendResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GroupRecommendBody = {
  segments?: DiarizedSegment[];
  labeledTranscript?: string;
  likes?: GuestLike[];
  likedVibes?: string[];
  dislikedVibes?: string[];
  userId?: string | null;
  excludeTmdbIds?: number[];
  sessionExcludeIds?: number[];
};

export async function POST(request: Request) {
  try {
    requireOpenAI();
    const body = (await request.json()) as GroupRecommendBody;
    const segments = Array.isArray(body.segments) ? body.segments : [];
    if (segments.length === 0 && !body.labeledTranscript?.trim()) {
      return jsonError(
        "Need a group discussion transcript.",
        "BAD_REQUEST",
        "Record some talk before suggesting.",
        400
      );
    }

    const group = await extractGroupIntent(
      segments.length
        ? segments
        : [
            {
              speaker: "Person 1",
              start: 0,
              end: 0,
              text: body.labeledTranscript!.trim(),
            },
          ]
    );

    if (!group.labeledTranscript.trim()) {
      return jsonError(
        "Discussion was empty.",
        "EMPTY_DISCUSSION",
        "Talk a bit longer, then tap Suggest.",
        400
      );
    }

    const result: RecommendResult & {
      segments: DiarizedSegment[];
      speakerNotes: Record<string, string>;
      labeledTranscript: string;
    } = {
      ...(await recommend({
        mode: "group",
        extract: group.extract,
        queryText: group.labeledTranscript,
        speakerNotes: group.speakerNotes,
        likes: body.likes,
        likedVibes: body.likedVibes,
        dislikedVibes: body.dislikedVibes,
        userId: body.userId,
        excludeTmdbIds: body.excludeTmdbIds,
        sessionExcludeIds: body.sessionExcludeIds,
      })),
      segments,
      speakerNotes: group.speakerNotes,
      labeledTranscript: group.labeledTranscript,
    };

    return Response.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
