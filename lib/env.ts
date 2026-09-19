import { ConfigError } from "@/lib/config-error";

/** Canonical names. Preferred when a GitHub alias is also set. */
export const OPENAI_KEY = "OPENAI_API_KEY";
export const TMDB_KEY = "TMDB_API_KEY";

/** GitHub secret aliases. OPENAI_CONVERSTION_WATCHNEXT is the given misspelling. */
export const OPENAI_KEY_ALIAS = "OPENAI_CONVERSTION_WATCHNEXT";
export const TMDB_KEY_ALIAS = "TMDB_API";

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

/** Prefer the canonical name when both are set. Never log values. */
export function resolveSecret(canonical: string, alias: string) {
  return readEnv(canonical) || readEnv(alias);
}

/** Which env name supplied the secret, or null if neither is set. */
export function secretNameUsed(canonical: string, alias: string) {
  if (readEnv(canonical)) return canonical;
  if (readEnv(alias)) return alias;
  return null;
}

/** Copy GitHub aliases into canonical names when the canonical value is empty. */
export function applyGitHubEnvAliases() {
  const openaiSource = secretNameUsed(OPENAI_KEY, OPENAI_KEY_ALIAS);
  const tmdbSource = secretNameUsed(TMDB_KEY, TMDB_KEY_ALIAS);
  const openai = resolveSecret(OPENAI_KEY, OPENAI_KEY_ALIAS);
  const tmdb = resolveSecret(TMDB_KEY, TMDB_KEY_ALIAS);
  if (openai && !readEnv(OPENAI_KEY)) process.env[OPENAI_KEY] = openai;
  if (tmdb && !readEnv(TMDB_KEY)) process.env[TMDB_KEY] = tmdb;
  return { openaiSource, tmdbSource };
}

export function getServerEnv() {
  applyGitHubEnvAliases();
  return {
    openaiKey: resolveSecret(OPENAI_KEY, OPENAI_KEY_ALIAS),
    tmdbKey: resolveSecret(TMDB_KEY, TMDB_KEY_ALIAS),
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
      `${OPENAI_KEY} is not set.`,
      "MISSING_OPENAI",
      `Add ${OPENAI_KEY} (or GitHub alias ${OPENAI_KEY_ALIAS}) to .env.local. Needed for ingest embeddings, recommendations, transcription, and TTS.`
    );
  }
  return key;
}

export function requireTmdb() {
  const key = getServerEnv().tmdbKey;
  if (!key) {
    throw new ConfigError(
      `${TMDB_KEY} is not set.`,
      "MISSING_TMDB",
      `Add ${TMDB_KEY} (or GitHub alias ${TMDB_KEY_ALIAS}) to .env.local. Needed to ingest the catalog.`
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
