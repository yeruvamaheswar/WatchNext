import { handleRouteError, jsonError } from "@/lib/errors";
import { getOpenAI, openaiModels } from "@/lib/openai";
import { requireOpenAI } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function languageHint(form: FormData, request: Request) {
  const fromForm = String(form.get("language") ?? "")
    .trim()
    .toLowerCase();
  if (/^[a-z]{2,3}$/.test(fromForm)) return fromForm;
  const accept = request.headers.get("accept-language") ?? "";
  const fromHeader = accept.split(",")[0]?.split("-")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z]{2,3}$/.test(fromHeader) ? fromHeader : undefined;
}

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
    const language = languageHint(form, request);
    const canStream = transcribe !== "whisper-1";

    if (canStream) {
      try {
        const stream = await openai.audio.transcriptions.create({
          file: named,
          model: transcribe,
          stream: true,
          ...(language ? { language } : {}),
        });
        if (stream && typeof stream === "object" && Symbol.asyncIterator in stream) {
          return sseFromTranscript(stream);
        }
        const maybeText = (stream as { text?: string } | null)?.text;
        if (typeof maybeText === "string") {
          return Response.json({ text: maybeText });
        }
      } catch {
        /* fall through to non-streaming / whisper */
      }
    }

    try {
      const result = await openai.audio.transcriptions.create({
        file: named,
        model: transcribe,
        ...(language ? { language } : {}),
      });
      return Response.json({ text: result.text ?? "" });
    } catch (err) {
      if (transcribe !== "whisper-1") {
        const result = await openai.audio.transcriptions.create({
          file: named,
          model: "whisper-1",
          ...(language ? { language } : {}),
        });
        return Response.json({ text: result.text ?? "" });
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}

function sseFromTranscript(
  stream: AsyncIterable<{ type?: string; delta?: string; text?: string }>
) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "transcript.text.delta" && event.delta) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: event.delta })}\n\n`)
            );
          } else if (event.type === "transcript.text.done") {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.text ?? "", done: true })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
