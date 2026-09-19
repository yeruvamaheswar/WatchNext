export function getPublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  // Both names must stay as static `process.env.NEXT_PUBLIC_*` reads so Next inlines them.
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    "";
  return {
    supabaseUrl,
    supabaseAnon,
    hasSupabase: Boolean(supabaseUrl && supabaseAnon),
  };
}
