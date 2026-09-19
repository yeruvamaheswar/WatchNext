import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAdmin } from "@/lib/env";
import { timedFetch } from "@/lib/timed-fetch";

let cached: SupabaseClient | null = null;

export function createAdminSupabase() {
  const env = requireSupabaseAdmin();
  if (cached) return cached;
  const key = env.supabaseService || env.supabaseAnon;
  cached = createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { retry: false },
    global: { fetch: timedFetch(2500) },
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
