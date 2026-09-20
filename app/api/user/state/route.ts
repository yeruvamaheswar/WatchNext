import { getServerEnv } from "@/lib/env";
import { handleRouteError, jsonError } from "@/lib/errors";
import { loadPersistedUserState, persistUserLists } from "@/lib/persist-user-state";
import { tryCreateAdminSupabase } from "@/lib/supabase/admin";
import { supabaseFetchTimeoutMs } from "@/lib/supabase/timeout";
import { isPersistedUserId } from "@/lib/user-state";
import { withTimeout } from "@/lib/with-timeout";
import type { GuestLike, TitleMark } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
    if (!isPersistedUserId(userId)) {
      return jsonError("Missing userId.", "BAD_REQUEST", undefined, 400);
    }

    const supabase = tryCreateAdminSupabase();
    if (!supabase) {
      return Response.json({
        exists: false,
        persisted: false,
        displayName: "Guest",
        onboardingComplete: false,
        likes: [],
        likedVibes: [],
        watchlist: [],
        seen: [],
      });
    }

    const state = await withTimeout(
      loadPersistedUserState(userId),
      supabaseFetchTimeoutMs(getServerEnv().supabaseUrl)
    );
    return Response.json(state);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      displayName?: string;
      isGuest?: boolean;
      likes?: GuestLike[];
      likedVibes?: string[];
      watchlist?: TitleMark[];
      seen?: TitleMark[];
      onboardingComplete?: boolean;
    };
    if (!isPersistedUserId(body.userId)) {
      return jsonError("Missing userId.", "BAD_REQUEST", undefined, 400);
    }

    const supabase = tryCreateAdminSupabase();
    if (!supabase) {
      return Response.json({ ok: true, persisted: false });
    }

    await withTimeout(
      persistUserLists({
        userId: body.userId,
        displayName: body.displayName,
        isGuest: body.isGuest,
        likes: body.likes,
        likedVibes: body.likedVibes,
        watchlist: body.watchlist,
        seen: body.seen,
        onboardingComplete: body.onboardingComplete,
      }),
      supabaseFetchTimeoutMs(getServerEnv().supabaseUrl)
    );
    return Response.json({ ok: true, persisted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
