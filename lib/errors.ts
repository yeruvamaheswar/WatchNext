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

export function handleRouteError(err: unknown) {
  if (err instanceof ConfigError) {
    return jsonError(err.message, err.code, err.hint, err.status);
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[watchnext]", err);
  return jsonError(message, "INTERNAL", undefined, 500);
}
