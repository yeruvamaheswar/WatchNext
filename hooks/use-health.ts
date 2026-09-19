"use client";

import { useEffect, useState } from "react";
import { getPublicEnv } from "@/lib/public-env";
import { supabaseFetchTimeoutMs } from "@/lib/supabase/timeout";
import { abortableFetch } from "@/lib/with-timeout";
import type { HealthStatus } from "@/lib/types";

export function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    abortableFetch("/api/health", {}, supabaseFetchTimeoutMs(getPublicEnv().supabaseUrl))
      .then((r) => r.json())
      .then((data: HealthStatus) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) {
          setHealth({
            ok: false,
            openai: false,
            tmdb: false,
            supabaseConfigured: false,
            supabaseReachable: false,
            catalogCount: null,
            missing: ["health"],
            hints: ["Could not load /api/health."],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return health;
}
