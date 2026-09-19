import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAdmin } from "@/lib/env";
import { timedFetch } from "@/lib/timed-fetch";

let cached: SupabaseClient | null = null;

export function createAdminSupabase() {
  const env = requireSupabaseAdmin();
  if (cached) return cached;
  cached = createClient(env.supabaseUrl, env.supabaseService, {
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
