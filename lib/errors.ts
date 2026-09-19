import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/config-error";

export { ConfigError };

export function jsonError(
  message: string,
  code: string,
  hint?: string,
  status = 503
) {
  return NextResponse.json({ error: message, code, hint }, { status });
}

function openaiApiError(err: unknown): ConfigError | null {
  if (!err || typeof err !== "object") return null;
  const anyErr = err as {
    status?: number;
    code?: string;
    message?: string;
    error?: { code?: string; message?: string; type?: string };
  };
  const status = anyErr.status;
  const code = anyErr.code || anyErr.error?.code || "";
  const message = anyErr.message || anyErr.error?.message || "";
  const blob = `${code} ${message}`.toLowerCase();
  if (
    status === 429 ||
    code === "insufficient_quota" ||
    /no credits remaining|insufficient_quota|rate limit/i.test(blob)
  ) {
    return new ConfigError(
      "OpenAI quota or rate limit blocked this request.",
      "OPENAI_QUOTA",
      "Add billing credits for this OpenAI key, or wait and retry. Keys are configured; the API rejected the call.",
      429
    );
  }
  if (status === 401 || code === "invalid_api_key") {
    return new ConfigError(
      "OpenAI rejected the API key.",
      "OPENAI_UNAUTHORIZED",
      "Check OPENAI_API_KEY (or GitHub alias OPENAI_CONVERSTION_WATCHNEXT).",
      401
    );
  }
  return null;
}

export function handleRouteError(err: unknown) {
  if (err instanceof ConfigError) {
    return jsonError(err.message, err.code, err.hint, err.status);
  }
  const mapped = openaiApiError(err);
  if (mapped) {
    return jsonError(mapped.message, mapped.code, mapped.hint, mapped.status);
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[watchnext]", err);
  return jsonError(message, "INTERNAL", undefined, 500);
}
