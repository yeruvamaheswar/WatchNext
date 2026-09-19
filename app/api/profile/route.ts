import { handleRouteError, jsonError } from "@/lib/errors";
import { tryCreateAdminSupabase } from "@/lib/supabase/admin";
import { withTimeout } from "@/lib/with-timeout";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      displayName?: string;
    };
    if (!body.userId || !body.displayName?.trim()) {
      return jsonError("Missing name.", "BAD_REQUEST", undefined, 400);
    }
    const supabase = tryCreateAdminSupabase();
    if (!supabase) {
      return Response.json({ ok: true, persisted: false });
    }
    try {
      await withTimeout(
        supabase.from("profiles").upsert(
          {
            id: body.userId,
            display_name: body.displayName.trim(),
          },
          { onConflict: "id" }
        ),
        2000
      );
      return Response.json({ ok: true, persisted: true });
    } catch {
      return Response.json({ ok: true, persisted: false });
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
