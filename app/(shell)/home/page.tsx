"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HealthBanner } from "@/components/health-banner";
import { MobileOrbDock } from "@/components/mobile-orb-dock";
import { PosterTiles } from "@/components/poster-tiles";
import { WatchOrb } from "@/components/watch-orb";
import { useWatchNext } from "@/hooks/use-watchnext";
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
          excludeTmdbIds: guest.seen.map((mark) => mark.tmdbId),
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

  const askAgain = (
    <WatchOrb loading={loading} compact onClick={() => void recommend()} />
  );

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col px-4 py-6">
      <h1 className="sr-only">Home</h1>
      <HealthBanner />
      {error ? (
        <div
          data-testid="recommend-error"
          className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
        >
          <p>{error.message}</p>
          {error.hint ? (
            <p className="mt-1 text-xs text-rose-100/70">{error.hint}</p>
          ) : null}
        </div>
      ) : null}
      {result ? (
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="hidden justify-center md:flex">{askAgain}</div>
          <PosterTiles titles={result.titles} swipeable />
          <div className="h-16 shrink-0 md:hidden" aria-hidden />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <WatchOrb loading={loading} onClick={() => void recommend()} />
        </div>
      )}
      <MobileOrbDock>
        {result ? (
          <WatchOrb
            loading={loading}
            docked
            onClick={() => void recommend()}
          />
        ) : null}
      </MobileOrbDock>
    </main>
  );
}
