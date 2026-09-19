export async function transcribeAudio(
  wav: Blob,
  options?: {
    signal?: AbortSignal;
    onPartial?: (text: string) => void;
  }
) {
  const form = new FormData();
  form.set("file", wav, "utterance.wav");
  const language =
    typeof navigator !== "undefined" ? navigator.language.split("-")[0]?.toLowerCase() : "";
  if (language) form.set("language", language);

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
    signal: options?.signal,
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || "Transcription failed.");
  }

  const ctype = res.headers.get("content-type") ?? "";
  if (ctype.includes("text/event-stream") && res.body) {
    return readTranscriptStream(res.body, options?.onPartial);
  }

  const json = (await res.json()) as { text?: string };
  const text = String(json.text ?? "").trim();
  if (text) options?.onPartial?.(text);
  return text;
}

async function readTranscriptStream(
  body: ReadableStream<Uint8Array>,
  onPartial?: (text: string) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part
        .split("\n")
        .find((entry) => entry.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as { delta?: string; text?: string };
        if (typeof parsed.text === "string") text = parsed.text;
        else if (typeof parsed.delta === "string") text += parsed.delta;
        if (text.trim()) onPartial?.(text.trim());
      } catch {
        /* ignore a torn SSE chunk */
      }
    }
  }

  return text.trim();
}
