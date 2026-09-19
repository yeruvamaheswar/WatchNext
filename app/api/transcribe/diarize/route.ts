import { normalizeDiarizedResponse } from "@/lib/diarize";
import { handleRouteError, jsonError } from "@/lib/errors";
import { getOpenAI, openaiModels } from "@/lib/openai";
import { requireOpenAI } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireOpenAI();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Missing audio.", "BAD_REQUEST", undefined, 400);
    }

    const openai = getOpenAI();
    const { diarize } = openaiModels();
    const buffer = Buffer.from(await file.arrayBuffer());
    const named = new File([buffer], file.name || "discussion.webm", {
      type: file.type || "audio/webm",
    });

    const result = await openai.audio.transcriptions.create({
      file: named,
      model: diarize,
      response_format: "diarized_json",
      chunking_strategy: "auto",
    } as Parameters<typeof openai.audio.transcriptions.create>[0]);

    const payload = result as unknown as {
      text?: string;
      segments?: Array<{
        speaker?: string;
        start?: number;
        end?: number;
        text?: string;
        type?: string;
      }>;
    };

    return Response.json(normalizeDiarizedResponse(payload));
  } catch (err) {
    return handleRouteError(err);
  }
}
