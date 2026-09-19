export function getPublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return {
    supabaseUrl,
    supabaseAnon,
    hasSupabase: Boolean(supabaseUrl && supabaseAnon),
  };
}
