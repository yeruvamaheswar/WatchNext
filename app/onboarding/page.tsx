"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SwipeDeck } from "@/components/swipe-deck";
import { useWatchNext } from "@/hooks/use-watchnext";
import {
  FALLBACK_MOVIES,
  FALLBACK_SHOWS,
  sampleOnboardingDeck,
  VIBE_CARDS,
} from "@/lib/onboarding-catalog";
import { abortableFetch } from "@/lib/with-timeout";
import type { TitleCard, VibeCard } from "@/lib/types";

const STEPS = [
  { id: "movies", title: "Movies", subtitle: "Swipe right to like, left to pass." },
  { id: "tv", title: "TV shows", subtitle: "Same deal — right like, left nope." },
  { id: "vibes", title: "Vibes", subtitle: "Seed the mood of your recs." },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const {
    ready,
    guest,
    recordVerdict,
    setVibeVerdict,
    completeOnboarding,
    rememberOnboardingDeck,
  } = useWatchNext();
  const [step, setStep] = useState(0);
  const [movies, setMovies] = useState<TitleCard[]>([]);
  const [shows, setShows] = useState<TitleCard[]>([]);
  const [vibes, setVibes] = useState<VibeCard[]>([]);
  const [deckReady, setDeckReady] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const stepRef = useRef(0);
  const fetchedRef = useRef(false);
  stepRef.current = step;

  useEffect(() => {
    if (!ready || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    const params = new URLSearchParams();
    const seen = guest.seenOnboarding;
    if (seen.movieIds.length) params.set("excludeMovies", seen.movieIds.join(","));
    if (seen.showIds.length) params.set("excludeShows", seen.showIds.join(","));
    if (seen.vibeIds.length) params.set("excludeVibes", seen.vibeIds.join(","));
    const query = params.toString();
    abortableFetch(`/api/onboarding/decks${query ? `?${query}` : ""}`, {}, 8000)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const nextMovies = data.movies?.length
          ? data.movies
          : sampleOnboardingDeck(FALLBACK_MOVIES);
        const nextShows = data.shows?.length
          ? data.shows
          : sampleOnboardingDeck(FALLBACK_SHOWS);
        const nextVibes = data.vibes?.length
          ? data.vibes
          : sampleOnboardingDeck(VIBE_CARDS);
        setMovies(nextMovies);
        setShows(nextShows);
        setVibes(nextVibes);
        rememberOnboardingDeck({
          movieIds: nextMovies.map((card: TitleCard) => card.tmdbId),
          showIds: nextShows.map((card: TitleCard) => card.tmdbId),
          vibeIds: nextVibes.map((card: VibeCard) => card.id),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setMovies(sampleOnboardingDeck(FALLBACK_MOVIES));
        setShows(sampleOnboardingDeck(FALLBACK_SHOWS));
        setVibes(sampleOnboardingDeck(VIBE_CARDS));
      })
      .finally(() => {
        if (!cancelled) setDeckReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [guest.seenOnboarding, ready, rememberOnboardingDeck]);

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
      backdropPath: v.backdropPath,
    }));
  }, [movies, shows, step, vibes]);

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      await completeOnboarding();
    } catch {
      // Local taste is already saved; still leave onboarding.
    }
    router.replace("/home");
  }

  function nextStep() {
    if (stepRef.current >= 2) {
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
      <div className="mt-6 flex-1">
        {finishing ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <p data-testid="onboarding-saving">Saving taste…</p>
          </div>
        ) : deckReady ? (
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
        ) : (
          <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
            Loading titles…
          </div>
        )}
      </div>
    </div>
  );
}
