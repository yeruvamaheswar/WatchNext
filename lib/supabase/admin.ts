import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAdmin } from "@/lib/env";
import { supabaseFetchTimeoutMs } from "@/lib/supabase/timeout";
import { timedFetch } from "@/lib/timed-fetch";

let cached: SupabaseClient | null = null;
let cachedKey = "";

export function createAdminSupabase() {
  const env = requireSupabaseAdmin();
  const key = env.supabaseService || env.supabaseAnon;
  const cacheKey = `${env.supabaseUrl}:${key}:${supabaseFetchTimeoutMs(env.supabaseUrl)}`;
  if (cached && cachedKey === cacheKey) return cached;
  cachedKey = cacheKey;
  cached = createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { retry: false },
    global: { fetch: timedFetch(supabaseFetchTimeoutMs(env.supabaseUrl)) },
  });
  return cached;
}

export function tryCreateAdminSupabase() {
  try {
    return createAdminSupabase();
  } catch {
    cached = null;
    return null;
  }
}
