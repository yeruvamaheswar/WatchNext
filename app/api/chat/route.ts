import { runChatTurn } from "@/lib/chat";
import { requireOpenAI } from "@/lib/env";
import { handleRouteError, jsonError } from "@/lib/errors";
import type { ChatTurnInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireOpenAI();
    const body = (await request.json()) as ChatTurnInput;
    const message = body.message?.trim();
    if (!message) {
      return jsonError("Missing message.", "BAD_REQUEST", undefined, 400);
    }
    const result = await runChatTurn({
      ...body,
      message,
    });
    return Response.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
