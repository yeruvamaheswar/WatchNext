import { handleRouteError, jsonError } from "@/lib/errors";
import { recomputeTaste } from "@/lib/taste";
import { tryCreateAdminSupabase } from "@/lib/supabase/admin";
import { withTimeout } from "@/lib/with-timeout";
import type { GuestLike } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      displayName?: string;
      isGuest?: boolean;
      likes?: GuestLike[];
      likedVibes?: string[];
    };
    if (!body.userId) {
      return jsonError("Missing userId.", "BAD_REQUEST", undefined, 400);
    }

    const supabase = tryCreateAdminSupabase();
    if (!supabase) {
      return Response.json({
        ok: true,
        persisted: false,
        hint: "Taste is saved on this device. Start local Supabase and set keys to persist vectors.",
      });
    }

    try {
      const result = await withTimeout(
        recomputeTaste({
          userId: body.userId,
          likes: body.likes ?? [],
          likedVibes: body.likedVibes ?? [],
          displayName: body.displayName,
          isGuest: body.isGuest,
        }),
        2500
      );
      return Response.json({ ok: true, persisted: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Taste recompute skipped.";
      return Response.json({
        ok: true,
        persisted: false,
        hint: message,
      });
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
