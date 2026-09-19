import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/public-env";
import { supabaseFetchTimeoutMs } from "@/lib/supabase/timeout";
import { timedFetch } from "@/lib/timed-fetch";

/** Cookie-less server client for public reads. Auth cookies are optional in v1. */
export function createServerSupabase() {
  const { supabaseUrl, supabaseAnon, hasSupabase } = getPublicEnv();
  if (!hasSupabase) return null;
  return createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { retry: false },
    global: { fetch: timedFetch(supabaseFetchTimeoutMs(supabaseUrl)) },
  });
}
