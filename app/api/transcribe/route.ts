import { handleRouteError, jsonError } from "@/lib/errors";
import { getOpenAI, openaiModels } from "@/lib/openai";
import { requireOpenAI } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireOpenAI();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Missing audio.", "BAD_REQUEST", undefined, 400);
    }

    const openai = getOpenAI();
    const { transcribe } = openaiModels();
    const buffer = Buffer.from(await file.arrayBuffer());
    const named = new File([buffer], file.name || "utterance.wav", {
      type: file.type || "audio/wav",
    });

    try {
      const result = await openai.audio.transcriptions.create({
        file: named,
        model: transcribe,
      });
      return Response.json({ text: result.text ?? "" });
    } catch (err) {
      if (transcribe !== "whisper-1") {
        const result = await openai.audio.transcriptions.create({
          file: named,
          model: "whisper-1",
        });
        return Response.json({ text: result.text ?? "" });
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
