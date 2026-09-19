"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HealthBanner } from "@/components/health-banner";
import { PosterTiles } from "@/components/poster-tiles";
import { Button } from "@/components/ui/button";
import { useWatchNext } from "@/hooks/use-watchnext";
import { primaryActionClass } from "@/lib/button-styles";
import type { RecommendResult } from "@/lib/types";

export default function HomePage() {
  const { userId, guest } = useWatchNext();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(
    null
  );

  async function recommend() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          likes: guest.likes,
          likedVibes: guest.likedVibes,
          queryText: "just pick something great to watch tonight",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ message: data.error || "Could not recommend.", hint: data.hint });
        toast.error(data.error || "Could not recommend.", {
          description: data.hint,
        });
        return;
      }
      setResult(data as RecommendResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not recommend.";
      setError({ message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <div>
        <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">Home</p>
        <h1 className="mt-1 text-3xl font-semibold">What should I watch?</h1>
      </div>
      <HealthBanner />
      {error ? (
        <div
          data-testid="recommend-error"
          className="rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
        >
          <p>{error.message}</p>
          {error.hint ? (
            <p className="mt-1 text-xs text-rose-100/70">{error.hint}</p>
          ) : null}
        </div>
      ) : null}
      <Button
        type="button"
        className={`w-full md:max-w-xs ${primaryActionClass}`}
        onClick={() => void recommend()}
        disabled={loading}
      >
        {loading ? "Picking…" : "What should I watch?"}
      </Button>
      {result?.spokenPitch ? (
        <p className="text-sm text-violet-100">{result.spokenPitch}</p>
      ) : null}
      {result ? <PosterTiles titles={result.titles} /> : null}
    </main>
  );
}
