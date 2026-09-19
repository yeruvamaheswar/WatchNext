import { createHash } from "crypto";
import { handleRouteError } from "@/lib/errors";
import { getOpenAI } from "@/lib/openai";
import { requireOpenAI } from "@/lib/env";
import { realtimeSessionConfig } from "@/lib/realtime-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireOpenAI();
    const body = (await request.json().catch(() => ({}))) as { userId?: string };
    const openai = getOpenAI();
    const userId = body.userId?.trim();
    const headers: Record<string, string> = {};
    if (userId) {
      headers["OpenAI-Safety-Identifier"] = createHash("sha256").update(userId).digest("hex");
    }

    const session = realtimeSessionConfig();
    let secret;
    try {
      secret = await openai.realtime.clientSecrets.create(
        {
          expires_after: { anchor: "created_at", seconds: 600 },
          session,
        },
        { headers }
      );
    } catch (err) {
      if (session.model !== "gpt-realtime") throw err;
      secret = await openai.realtime.clientSecrets.create(
        {
          expires_after: { anchor: "created_at", seconds: 600 },
          session: {
            ...session,
            model: "gpt-4o-realtime-preview",
            audio: {
              ...session.audio,
              output: { ...session.audio?.output, voice: "alloy" },
            },
          },
        },
        { headers }
      );
    }

    return Response.json({
      value: secret.value,
      expiresAt: secret.expires_at,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
