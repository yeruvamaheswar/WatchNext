import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/public-env";
import { timedFetch } from "@/lib/timed-fetch";

export function createBrowserSupabase() {
  const { supabaseUrl, supabaseAnon, hasSupabase } = getPublicEnv();
  if (!hasSupabase) return null;
  return createBrowserClient(supabaseUrl, supabaseAnon, {
    db: { retry: false },
    global: { fetch: timedFetch(2500) },
  });
}
