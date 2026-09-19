"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SwipeDeck } from "@/components/swipe-deck";
import { Button } from "@/components/ui/button";
import { useWatchNext } from "@/hooks/use-watchnext";
import {
  FALLBACK_MOVIES,
  FALLBACK_SHOWS,
  VIBE_CARDS,
} from "@/lib/onboarding-catalog";
import { abortableFetch } from "@/lib/with-timeout";
import type { TitleCard, VibeCard } from "@/lib/types";

const STEPS = [
  { id: "movies", title: "Movies", subtitle: "Swipe the ones you’d actually watch." },
  { id: "tv", title: "TV shows", subtitle: "Same deal — right like, left nope." },
  { id: "vibes", title: "Vibes", subtitle: "Seed the mood of your recs." },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { ready, guest, recordVerdict, setVibeVerdict, completeOnboarding } =
    useWatchNext();
  const [step, setStep] = useState(0);
  const [movies, setMovies] = useState<TitleCard[]>(FALLBACK_MOVIES);
  const [shows, setShows] = useState<TitleCard[]>(FALLBACK_SHOWS);
  const [vibes, setVibes] = useState<VibeCard[]>(VIBE_CARDS);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    abortableFetch("/api/onboarding/decks", {}, 2500)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.movies?.length) setMovies(data.movies);
        if (data.shows?.length) setShows(data.shows);
        if (data.vibes?.length) setVibes(data.vibes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready && guest.onboardingComplete) router.replace("/home");
  }, [guest.onboardingComplete, ready, router]);

  const items = useMemo(() => {
    if (step === 0) return movies.map((card) => ({ kind: "title" as const, card }));
    if (step === 1) return shows.map((card) => ({ kind: "title" as const, card }));
    return vibes.map((v) => ({
      kind: "vibe" as const,
      id: v.id,
      name: v.name,
      description: v.description,
    }));
  }, [movies, shows, step, vibes]);

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    await completeOnboarding();
    router.replace("/home");
  }

  function nextStep() {
    if (step >= 2) {
      void finish();
      return;
    }
    setStep((s) => Math.min(s + 1, 2));
  }

  const meta = STEPS[step];

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-8"
      style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
    >
      <div className="mb-4 flex gap-2">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-violet-400" : "bg-white/10"}`}
          />
        ))}
      </div>
      <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">
        Question {step + 1} of 3
      </p>
      <h1 className="mt-2 text-3xl font-semibold" data-testid="onboarding-title">
        {meta.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
      <div className="relative z-30 mt-4 flex justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 min-w-24 rounded-full"
          data-testid="onboarding-skip"
          onClick={nextStep}
        >
          Skip
        </Button>
        {step === 2 ? (
          <Button
            type="button"
            className="h-12 min-w-28 rounded-full"
            data-testid="onboarding-finish"
            onClick={() => void finish()}
            disabled={finishing}
          >
            {finishing ? "Saving taste…" : "Finish"}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-12 min-w-28 rounded-full"
            data-testid="onboarding-next"
            onClick={nextStep}
          >
            Next
          </Button>
        )}
      </div>
      <div className="mt-4 flex-1">
        <SwipeDeck
          key={step}
          items={items}
          onLike={(item) => {
            if (item.kind === "title") {
              recordVerdict({
                tmdbId: item.card.tmdbId,
                mediaType: item.card.mediaType,
                verdict: "like",
                source: "onboarding",
                name: item.card.name,
              });
            } else {
              setVibeVerdict(item.id, true);
            }
          }}
          onDislike={(item) => {
            if (item.kind === "title") {
              recordVerdict({
                tmdbId: item.card.tmdbId,
                mediaType: item.card.mediaType,
                verdict: "dislike",
                source: "onboarding",
                name: item.card.name,
              });
            } else {
              setVibeVerdict(item.id, false);
            }
          }}
          onEmpty={nextStep}
        />
      </div>
    </div>
  );
}
