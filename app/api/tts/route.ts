import { handleRouteError, jsonError } from "@/lib/errors";
import { getOpenAI, openaiModels } from "@/lib/openai";
import { requireOpenAI } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireOpenAI();
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) {
      return jsonError("Missing text.", "BAD_REQUEST", undefined, 400);
    }
    const openai = getOpenAI();
    const { tts, voice } = openaiModels();
    const speech = await openai.audio.speech.create({
      model: tts,
      voice: voice as "nova",
      input: text.slice(0, 400),
      response_format: "mp3",
    });
    const audio = Buffer.from(await speech.arrayBuffer());
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
