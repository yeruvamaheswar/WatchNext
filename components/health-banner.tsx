"use client";

import { useHealth } from "@/hooks/use-health";

export function HealthBanner() {
  const health = useHealth();
  if (!health || health.ok) return null;
  const text = health.hints[0] || health.missing.join(", ");
  if (!text) return null;
  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-950/50 px-4 py-3 text-xs text-violet-100">
      {text}
    </div>
  );
}
