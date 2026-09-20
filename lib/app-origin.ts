import { headers } from "next/headers";

function firstHeader(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function urlFrom(value: string | undefined): URL | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** Public origin for metadata (icons, OG). */
export async function appOrigin(): Promise<URL> {
  const fromEnv =
    urlFrom(process.env.NEXT_PUBLIC_APP_URL) || urlFrom(process.env.WATCHNEXT_APP_URL);
  if (fromEnv) return fromEnv;

  const h = await headers();
  const host =
    firstHeader(h.get("x-forwarded-host")) || firstHeader(h.get("host")) || "localhost:3000";
  const forwarded = firstHeader(h.get("x-forwarded-proto"))?.toLowerCase();
  const proto = forwarded === "https" || forwarded === "http" ? forwarded : "http";
  return new URL(`${proto}://${host}`);
}
