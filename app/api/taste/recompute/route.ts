import { handleRouteError, jsonError } from "@/lib/errors";
import { recomputeTaste } from "@/lib/taste";
import type { GuestLike } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      likes?: GuestLike[];
      likedVibes?: string[];
      displayName?: string;
      isGuest?: boolean;
    };
    if (!body.userId) {
      return jsonError("Missing userId.", "BAD_REQUEST", undefined, 400);
    }
    const result = await recomputeTaste({
      userId: body.userId,
      likes: body.likes ?? [],
      likedVibes: body.likedVibes ?? [],
      displayName: body.displayName,
      isGuest: body.isGuest,
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return handleRouteError(err);
  }
}
