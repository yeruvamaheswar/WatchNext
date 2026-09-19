/**
 * Verifies GitHub secret aliases resolve without printing values.
 * Run: npx tsx scripts/verify-openai-env.ts
 */
import assert from "node:assert/strict";
import {
  OPENAI_KEY,
  OPENAI_KEY_ALIAS,
  TMDB_KEY,
  TMDB_KEY_ALIAS,
  applyGitHubEnvAliases,
  getServerEnv,
  resolveSecret,
  secretNameUsed,
} from "../lib/env";

function snapshotEnv(names: string[]) {
  const out: Record<string, string | undefined> = {};
  for (const name of names) out[name] = process.env[name];
  return out;
}

function restoreEnv(
  names: string[],
  snap: Record<string, string | undefined>
) {
  for (const name of names) {
    const value = snap[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function main() {
  const tracked = [OPENAI_KEY, OPENAI_KEY_ALIAS, TMDB_KEY, TMDB_KEY_ALIAS];
  const liveSources = {
    openaiSource: secretNameUsed(OPENAI_KEY, OPENAI_KEY_ALIAS),
    tmdbSource: secretNameUsed(TMDB_KEY, TMDB_KEY_ALIAS),
  };
  const snap = snapshotEnv(tracked);

  try {
    delete process.env[OPENAI_KEY];
    delete process.env[OPENAI_KEY_ALIAS];
    delete process.env[TMDB_KEY];
    delete process.env[TMDB_KEY_ALIAS];

    process.env[OPENAI_KEY_ALIAS] = "sk-test-alias";
    process.env[TMDB_KEY_ALIAS] = "tmdb-alias";
    assert.equal(
      resolveSecret(OPENAI_KEY, OPENAI_KEY_ALIAS),
      "sk-test-alias"
    );
    assert.equal(secretNameUsed(OPENAI_KEY, OPENAI_KEY_ALIAS), OPENAI_KEY_ALIAS);
    const aliases = applyGitHubEnvAliases();
    assert.equal(aliases.openaiSource, OPENAI_KEY_ALIAS);
    assert.equal(aliases.tmdbSource, TMDB_KEY_ALIAS);
    assert.equal(process.env[OPENAI_KEY], "sk-test-alias");
    assert.equal(process.env[TMDB_KEY], "tmdb-alias");

    process.env[OPENAI_KEY] = "sk-canonical";
    assert.equal(resolveSecret(OPENAI_KEY, OPENAI_KEY_ALIAS), "sk-canonical");
    assert.equal(secretNameUsed(OPENAI_KEY, OPENAI_KEY_ALIAS), OPENAI_KEY);
  } finally {
    restoreEnv(tracked, snap);
  }

  applyGitHubEnvAliases();
  const env = getServerEnv();
  console.log(
    JSON.stringify(
      {
        ok: true,
        openaiConfigured: Boolean(env.openaiKey),
        tmdbConfigured: Boolean(env.tmdbKey),
        openaiSource: liveSources.openaiSource,
        tmdbSource: liveSources.tmdbSource,
        chatModel: env.chatModel,
      },
      null,
      2
    )
  );
}

main();
