export function isLocalSupabaseUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "[::1]" ||
      host === "::1"
    );
  } catch {
    return false;
  }
}

/** Local Docker should fail fast. Hosted needs room for TLS + RPC. */
export function supabaseFetchTimeoutMs(url: string) {
  return isLocalSupabaseUrl(url) ? 2500 : 15_000;
}

export function supabaseUnreachableMessage(url: string) {
  return isLocalSupabaseUrl(url)
    ? "Could not reach local Supabase."
    : "Could not reach Supabase.";
}

export function supabaseUnreachableHint(url: string) {
  return isLocalSupabaseUrl(url)
    ? "Start it with `npx supabase start` (Docker required), then retry."
    : "Check NEXT_PUBLIC_SUPABASE_URL and that the hosted project is reachable.";
}
