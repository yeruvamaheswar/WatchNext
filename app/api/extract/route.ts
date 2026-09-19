import { handleRouteError, jsonError } from "@/lib/errors";
import { extractIntent } from "@/lib/extract";
import { requireOpenAI } from "@/lib/env";
import type { ExtractedIntent } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireOpenAI();
    const body = (await request.json()) as {
      transcript?: string;
      prior?: string;
    };
    const transcript = body.transcript?.trim();
    if (!transcript) {
      return jsonError("Missing transcript.", "BAD_REQUEST", undefined, 400);
    }
    const extract: ExtractedIntent = await extractIntent(
      transcript,
      body.prior
    );
    return Response.json({ extract });
  } catch (err) {
    return handleRouteError(err);
  }
}
