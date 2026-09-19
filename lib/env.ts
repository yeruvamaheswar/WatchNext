import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { loadEnvConfig } from "@next/env";
import { ConfigError } from "@/lib/config-error";

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

export function getServerEnv() {
  const fileEnv = loadMergedEnv();
  return {
    openaiKey: firstNonEmpty(readProcessEnv("OPENAI_API_KEY"), fileEnv.OPENAI_API_KEY),
    tmdbKey: firstNonEmpty(readProcessEnv("TMDB_API_KEY"), fileEnv.TMDB_API_KEY),
    supabaseUrl: firstNonEmpty(
      readProcessEnv("NEXT_PUBLIC_SUPABASE_URL"),
      fileEnv.NEXT_PUBLIC_SUPABASE_URL
    ),
    supabaseAnon: firstNonEmpty(
      readProcessEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    supabaseService: firstNonEmpty(
      readProcessEnv("SUPABASE_SERVICE_ROLE_KEY"),
      fileEnv.SUPABASE_SERVICE_ROLE_KEY
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
    ttsModel: firstNonEmpty(readProcessEnv("OPENAI_TTS_MODEL"), fileEnv.OPENAI_TTS_MODEL) || "tts-1",
    ttsVoice: firstNonEmpty(readProcessEnv("OPENAI_TTS_VOICE"), fileEnv.OPENAI_TTS_VOICE) || "nova",
    ingestPages:
      Number(firstNonEmpty(readProcessEnv("TMDB_INGEST_PAGES"), fileEnv.TMDB_INGEST_PAGES) || 10) ||
      10,
    openaiKeyBlankInFile: Object.hasOwn(fileEnv, "OPENAI_API_KEY") && !fileEnv.OPENAI_API_KEY?.trim(),
    tmdbKeyBlankInFile: Object.hasOwn(fileEnv, "TMDB_API_KEY") && !fileEnv.TMDB_API_KEY?.trim(),
  };
}

function openaiHint() {
  const env = getServerEnv();
  if (env.openaiKeyBlankInFile) {
    return "OPENAI_API_KEY is listed in .env.local but the value is blank. Paste the key on that same line (OPENAI_API_KEY=sk-...), save the file, then try again.";
  }
  return "Add OPENAI_API_KEY to .env.local. Needed for ingest embeddings, recommendations, transcription, and TTS.";
}

export function requireOpenAI() {
  const key = getServerEnv().openaiKey;
  if (!key) {
    throw new ConfigError("OPENAI_API_KEY is not set.", "MISSING_OPENAI", openaiHint());
  }
  return key;
}

export function requireTmdb() {
  const key = getServerEnv().tmdbKey;
  if (!key) {
    throw new ConfigError(
      "TMDB_API_KEY is not set.",
      "MISSING_TMDB",
      getServerEnv().tmdbKeyBlankInFile
        ? "TMDB_API_KEY is listed in .env.local but the value is blank. Paste the key on that same line, save the file, then try again."
        : "Add TMDB_API_KEY to .env.local. Needed to ingest the catalog."
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
