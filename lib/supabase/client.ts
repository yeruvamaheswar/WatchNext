import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/public-env";
import { supabaseFetchTimeoutMs } from "@/lib/supabase/timeout";
import { timedFetch } from "@/lib/timed-fetch";

/** Local Supabase is stored as 127.0.0.1; phones need this machine's LAN host. */
function resolveBrowserSupabaseUrl(url: string) {
  if (typeof window === "undefined") return url;
  try {
    const parsed = new URL(url);
    const loopback =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "0.0.0.0" ||
      parsed.hostname === "[::1]" ||
      parsed.hostname === "::1";
    const pageHost = window.location.hostname;
    if (loopback && pageHost && pageHost !== parsed.hostname) {
      parsed.hostname = pageHost;
      return parsed.origin;
    }
  } catch {
    // keep configured URL
  }
  return url;
}

let cached: SupabaseClient | null = null;
let cachedKey = "";

export function createBrowserSupabase() {
  const { supabaseUrl, supabaseAnon, hasSupabase } = getPublicEnv();
  if (!hasSupabase) return null;
  const browserUrl = resolveBrowserSupabaseUrl(supabaseUrl);
  const cacheKey = `${browserUrl}:${supabaseAnon}`;
  if (cached && cachedKey === cacheKey) return cached;
  cachedKey = cacheKey;
  cached = createClient(browserUrl, supabaseAnon, {
    db: { retry: false },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { fetch: timedFetch(supabaseFetchTimeoutMs(browserUrl)) },
  });
  return cached;
}
