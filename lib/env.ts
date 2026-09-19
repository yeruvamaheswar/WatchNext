import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { loadEnvConfig } from "@next/env";
import { ConfigError } from "@/lib/config-error";

/** Canonical names. Preferred when a GitHub alias is also set. */
export const OPENAI_KEY = "OPENAI_API_KEY";
export const TMDB_KEY = "TMDB_API_KEY";

/** GitHub secret aliases. OPENAI_CONVERSTION_WATCHNEXT is the given misspelling. */
export const OPENAI_KEY_ALIAS = "OPENAI_CONVERSTION_WATCHNEXT";
export const TMDB_KEY_ALIAS = "TMDB_API";

function readProcessEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function parseEnvFile(filePath: string) {
  const values: Record<string, string> = {};
  if (!existsSync(filePath)) return values;
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim() ?? "";
    if (trimmed) return trimmed;
  }
  return "";
}

function loadMergedEnv() {
  loadEnvConfig(process.cwd());
  const fileEnv = parseEnvFile(join(process.cwd(), ".env.local"));
  for (const [key, value] of Object.entries(fileEnv)) {
    if (value && !process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }
  return fileEnv;
}

/** Prefer the canonical name when both are set. Never log values. */
export function resolveSecret(canonical: string, alias: string) {
  return readProcessEnv(canonical) || readProcessEnv(alias);
}

/** Which env name supplied the secret, or null if neither is set. */
export function secretNameUsed(canonical: string, alias: string) {
  if (readProcessEnv(canonical)) return canonical;
  if (readProcessEnv(alias)) return alias;
  return null;
}

/** Copy GitHub aliases into canonical names when the canonical value is empty. */
export function applyGitHubEnvAliases() {
  const openaiSource = secretNameUsed(OPENAI_KEY, OPENAI_KEY_ALIAS);
  const tmdbSource = secretNameUsed(TMDB_KEY, TMDB_KEY_ALIAS);
  const openai = resolveSecret(OPENAI_KEY, OPENAI_KEY_ALIAS);
  const tmdb = resolveSecret(TMDB_KEY, TMDB_KEY_ALIAS);
  if (openai && !readProcessEnv(OPENAI_KEY)) process.env[OPENAI_KEY] = openai;
  if (tmdb && !readProcessEnv(TMDB_KEY)) process.env[TMDB_KEY] = tmdb;
  return { openaiSource, tmdbSource };
}

function fileHasBlank(fileEnv: Record<string, string>, ...names: string[]) {
  const listed = names.filter((name) => Object.hasOwn(fileEnv, name));
  if (listed.length === 0) return false;
  return listed.every((name) => !fileEnv[name]?.trim());
}

export function getServerEnv() {
  const fileEnv = loadMergedEnv();
  applyGitHubEnvAliases();
  return {
    openaiKey: firstNonEmpty(
      readProcessEnv(OPENAI_KEY),
      fileEnv[OPENAI_KEY],
      readProcessEnv(OPENAI_KEY_ALIAS),
      fileEnv[OPENAI_KEY_ALIAS]
    ),
    tmdbKey: firstNonEmpty(
      readProcessEnv(TMDB_KEY),
      fileEnv[TMDB_KEY],
      readProcessEnv(TMDB_KEY_ALIAS),
      fileEnv[TMDB_KEY_ALIAS]
    ),
    supabaseUrl: firstNonEmpty(
      readProcessEnv("NEXT_PUBLIC_SUPABASE_URL"),
      fileEnv.NEXT_PUBLIC_SUPABASE_URL
    ),
    supabaseAnon: firstNonEmpty(
      readProcessEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      readProcessEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      fileEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
    supabaseService: firstNonEmpty(
      readProcessEnv("SUPABASE_SERVICE_ROLE_KEY"),
      fileEnv.SUPABASE_SERVICE_ROLE_KEY,
      readProcessEnv("SUPABASE_SECRET_KEY"),
      fileEnv.SUPABASE_SECRET_KEY
    ),
    embeddingModel:
      firstNonEmpty(readProcessEnv("OPENAI_EMBEDDING_MODEL"), fileEnv.OPENAI_EMBEDDING_MODEL) ||
      "text-embedding-3-small",
    chatModel:
      firstNonEmpty(readProcessEnv("OPENAI_CHAT_MODEL"), fileEnv.OPENAI_CHAT_MODEL) ||
      "gpt-4o-mini",
    transcribeModel:
      firstNonEmpty(readProcessEnv("OPENAI_TRANSCRIBE_MODEL"), fileEnv.OPENAI_TRANSCRIBE_MODEL) ||
      "gpt-4o-transcribe",
    diarizeModel:
      firstNonEmpty(readProcessEnv("OPENAI_DIARIZE_MODEL"), fileEnv.OPENAI_DIARIZE_MODEL) ||
      "gpt-4o-transcribe-diarize",
    ttsModel: firstNonEmpty(readProcessEnv("OPENAI_TTS_MODEL"), fileEnv.OPENAI_TTS_MODEL) || "tts-1",
    ttsVoice: firstNonEmpty(readProcessEnv("OPENAI_TTS_VOICE"), fileEnv.OPENAI_TTS_VOICE) || "nova",
    realtimeModel:
      firstNonEmpty(readProcessEnv("OPENAI_REALTIME_MODEL"), fileEnv.OPENAI_REALTIME_MODEL) ||
      "gpt-realtime",
    realtimeVoice:
      firstNonEmpty(readProcessEnv("OPENAI_REALTIME_VOICE"), fileEnv.OPENAI_REALTIME_VOICE) ||
      "marin",
    ingestPages:
      Number(firstNonEmpty(readProcessEnv("TMDB_INGEST_PAGES"), fileEnv.TMDB_INGEST_PAGES) || 10) ||
      10,
    openaiKeyBlankInFile: fileHasBlank(fileEnv, OPENAI_KEY, OPENAI_KEY_ALIAS),
    tmdbKeyBlankInFile: fileHasBlank(fileEnv, TMDB_KEY, TMDB_KEY_ALIAS),
  };
}

function openaiHint() {
  const env = getServerEnv();
  if (env.openaiKeyBlankInFile) {
    return `${OPENAI_KEY} (or GitHub alias ${OPENAI_KEY_ALIAS}) is listed in .env.local but the value is blank. Paste the key on that same line (${OPENAI_KEY}=sk-...), save the file, then try again.`;
  }
  return `Add ${OPENAI_KEY} (or GitHub alias ${OPENAI_KEY_ALIAS}) to .env.local. Needed for ingest embeddings, recommendations, transcription, and TTS.`;
}

export function requireOpenAI() {
  const key = getServerEnv().openaiKey;
  if (!key) {
    throw new ConfigError(`${OPENAI_KEY} is not set.`, "MISSING_OPENAI", openaiHint());
  }
  return key;
}

export function requireTmdb() {
  const key = getServerEnv().tmdbKey;
  if (!key) {
    throw new ConfigError(
      `${TMDB_KEY} is not set.`,
      "MISSING_TMDB",
      getServerEnv().tmdbKeyBlankInFile
        ? `${TMDB_KEY} (or GitHub alias ${TMDB_KEY_ALIAS}) is listed in .env.local but the value is blank. Paste the key on that same line, save the file, then try again.`
        : `Add ${TMDB_KEY} (or GitHub alias ${TMDB_KEY_ALIAS}) to .env.local. Needed to ingest the catalog.`
    );
  }
  return key;
}

export function requireSupabaseAdmin() {
  const env = getServerEnv();
  if (!env.supabaseUrl || (!env.supabaseService && !env.supabaseAnon)) {
    throw new ConfigError(
      "Supabase is not configured.",
      "MISSING_SUPABASE",
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local. Ingest and other privileged writes also need SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY."
    );
  }
  return env;
}
