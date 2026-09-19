import {
  OPENAI_KEY,
  OPENAI_KEY_ALIAS,
  TMDB_KEY,
  TMDB_KEY_ALIAS,
  getServerEnv,
} from "@/lib/env";
import { getPublicEnv } from "@/lib/public-env";
import { tryCreateAdminSupabase } from "@/lib/supabase/admin";
import {
  supabaseFetchTimeoutMs,
  supabaseUnreachableHint,
} from "@/lib/supabase/timeout";
import { withTimeout } from "@/lib/with-timeout";
import type { HealthStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  const pub = getPublicEnv();
  const missing: string[] = [];
  const hints: string[] = [];

  if (!env.openaiKey) {
    missing.push(`${OPENAI_KEY} (or ${OPENAI_KEY_ALIAS})`);
    hints.push(
      env.openaiKeyBlankInFile
        ? `${OPENAI_KEY} (or GitHub alias ${OPENAI_KEY_ALIAS}) is listed in .env.local but the value is blank. Paste the key on that same line, save the file, then refresh.`
        : `Recommendations, ingest embeddings, STT, and TTS need ${OPENAI_KEY} or GitHub alias ${OPENAI_KEY_ALIAS} in .env.local.`
    );
  }
  if (!env.tmdbKey) {
    missing.push(`${TMDB_KEY} (or ${TMDB_KEY_ALIAS})`);
    hints.push(
      env.tmdbKeyBlankInFile
        ? `${TMDB_KEY} (or GitHub alias ${TMDB_KEY_ALIAS}) is listed in .env.local but the value is blank. Paste the key on that same line, save the file, then refresh.`
        : `Catalog ingest needs ${TMDB_KEY} or GitHub alias ${TMDB_KEY_ALIAS}.`
    );
  }
  if (!pub.hasSupabase) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL / ANON or PUBLISHABLE KEY");
    hints.push(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local."
    );
  }

  let supabaseReachable = false;
  let catalogCount: number | null = null;
  const supabase = tryCreateAdminSupabase();
  if (supabase) {
    try {
      const { count, error } = await withTimeout(
        supabase.from("titles").select("id", { count: "exact", head: true }),
        supabaseFetchTimeoutMs(env.supabaseUrl)
      );
      if (!error) {
        supabaseReachable = true;
        catalogCount = count ?? 0;
        if (!count) {
          hints.push("Catalog is empty. Run `npm run ingest`.");
        }
      } else {
        hints.push(
          `Supabase is configured but not reachable. ${supabaseUnreachableHint(env.supabaseUrl)}`
        );
      }
    } catch {
      hints.push(
        `Supabase is configured but not reachable. ${supabaseUnreachableHint(env.supabaseUrl)}`
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
