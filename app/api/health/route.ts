import { getServerEnv, getPublicEnv } from "@/lib/env";
import { tryCreateAdminSupabase } from "@/lib/supabase/admin";
import { withTimeout } from "@/lib/with-timeout";
import type { HealthStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  const pub = getPublicEnv();
  const missing: string[] = [];
  const hints: string[] = [];

  if (!env.openaiKey) {
    missing.push("OPENAI_API_KEY");
    hints.push("Recommendations, ingest embeddings, STT, and TTS need OPENAI_API_KEY in .env.local.");
  }
  if (!env.tmdbKey) {
    missing.push("TMDB_API_KEY");
    hints.push("Catalog ingest needs TMDB_API_KEY.");
  }
  if (!pub.hasSupabase) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL / ANON KEY");
    hints.push("Run `npx supabase start` and copy keys into .env.local.");
  }

  let supabaseReachable = false;
  let catalogCount: number | null = null;
  const supabase = tryCreateAdminSupabase();
  if (supabase) {
    try {
      const { count, error } = await withTimeout(
        supabase.from("titles").select("id", { count: "exact", head: true }),
        2000
      );
      if (!error) {
        supabaseReachable = true;
        catalogCount = count ?? 0;
        if (!count) {
          hints.push("Catalog is empty. Run `npm run ingest`.");
        }
      } else {
        hints.push(
          "Supabase is configured but not reachable. Run `npx supabase start` (Docker), then retry."
        );
      }
    } catch {
      hints.push(
        "Supabase is configured but not reachable. Run `npx supabase start` (Docker), then retry."
      );
    }
  }

  const body: HealthStatus = {
    ok: missing.length === 0 && supabaseReachable,
    openai: Boolean(env.openaiKey),
    tmdb: Boolean(env.tmdbKey),
    supabaseConfigured: pub.hasSupabase,
    supabaseReachable,
    catalogCount,
    missing,
    hints,
  };
  return Response.json(body);
}
