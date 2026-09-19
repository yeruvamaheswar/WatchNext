import { ConfigError } from "@/lib/config-error";

export function getServerEnv() {
  return {
    openaiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
    tmdbKey: process.env.TMDB_API_KEY?.trim() ?? "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    supabaseAnon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
    supabaseService: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
    embeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
    chatModel: process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini",
    transcribeModel:
      process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-transcribe",
    ttsModel: process.env.OPENAI_TTS_MODEL?.trim() || "tts-1",
    ttsVoice: process.env.OPENAI_TTS_VOICE?.trim() || "nova",
    ingestPages: Number(process.env.TMDB_INGEST_PAGES ?? 10) || 10,
  };
}

export function getPublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return {
    supabaseUrl,
    supabaseAnon,
    hasSupabase: Boolean(supabaseUrl && supabaseAnon),
  };
}

export function requireOpenAI() {
  const key = getServerEnv().openaiKey;
  if (!key) {
    throw new ConfigError(
      "OPENAI_API_KEY is not set.",
      "MISSING_OPENAI",
      "Add OPENAI_API_KEY to .env.local. Needed for ingest embeddings, recommendations, transcription, and TTS."
    );
  }
  return key;
}

export function requireTmdb() {
  const key = getServerEnv().tmdbKey;
  if (!key) {
    throw new ConfigError(
      "TMDB_API_KEY is not set.",
      "MISSING_TMDB",
      "Add TMDB_API_KEY to .env.local. Needed to ingest the catalog."
    );
  }
  return key;
}

export function requireSupabaseAdmin() {
  const env = getServerEnv();
  if (!env.supabaseUrl || !env.supabaseService) {
    throw new ConfigError(
      "Local Supabase is not configured.",
      "MISSING_SUPABASE",
      "Run `npx supabase start`, then set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
  return env;
}
