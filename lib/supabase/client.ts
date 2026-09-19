import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/public-env";
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

export function createBrowserSupabase() {
  const { supabaseUrl, supabaseAnon, hasSupabase } = getPublicEnv();
  if (!hasSupabase) return null;
  return createBrowserClient(resolveBrowserSupabaseUrl(supabaseUrl), supabaseAnon, {
    db: { retry: false },
    global: { fetch: timedFetch(2500) },
  });
}
