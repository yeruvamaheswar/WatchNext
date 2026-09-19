import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { timedFetch } from "@/lib/timed-fetch";

/** Cookie-less server client for public reads. Auth cookies are optional in v1. */
export function createServerSupabase() {
  const { supabaseUrl, supabaseAnon, hasSupabase } = getPublicEnv();
  if (!hasSupabase) return null;
  return createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { retry: false },
    global: { fetch: timedFetch(2500) },
  });
}
