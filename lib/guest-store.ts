const KEY = "watchnext-guest-v1";

import type { GuestLike, GuestState, SeenOnboarding } from "@/lib/types";

const emptySeen = (): SeenOnboarding => ({
  movieIds: [],
  showIds: [],
  vibeIds: [],
});

function uniqueNumbers(ids: number[], extra: number[], keep = 60) {
  return [...new Set([...ids, ...extra])].slice(-keep);
}

function uniqueStrings(ids: string[], extra: string[], keep = 30) {
  return [...new Set([...ids, ...extra])].slice(-keep);
}

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `guest-${Math.random().toString(16).slice(2)}`;
}

export const GUEST_SSR: GuestState = {
  guestId: "",
  displayName: "Guest",
  onboardingComplete: false,
  likes: [],
  likedVibes: [],
  dislikedVibes: [],
  seenOnboarding: emptySeen(),
};

export function emptyGuest(): GuestState {
  return {
    guestId: randomId(),
    displayName: "Guest",
    onboardingComplete: false,
    likes: [],
    likedVibes: [],
    dislikedVibes: [],
    seenOnboarding: emptySeen(),
  };
}

export function loadGuest(): GuestState {
  if (typeof window === "undefined") return emptyGuest();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const fresh = emptyGuest();
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as GuestState;
    return {
      guestId: parsed.guestId || randomId(),
      displayName: parsed.displayName || "Guest",
      onboardingComplete: Boolean(parsed.onboardingComplete),
      likes: parsed.likes ?? [],
      likedVibes: parsed.likedVibes ?? [],
      dislikedVibes: parsed.dislikedVibes ?? [],
      seenOnboarding: {
        movieIds: parsed.seenOnboarding?.movieIds ?? [],
        showIds: parsed.seenOnboarding?.showIds ?? [],
        vibeIds: parsed.seenOnboarding?.vibeIds ?? [],
      },
    };
  } catch {
    const fresh = emptyGuest();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }
}

export function saveGuest(state: GuestState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearGuest() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function rememberSeenOnboarding(
  seen: SeenOnboarding | undefined,
  next: Partial<SeenOnboarding>
): SeenOnboarding {
  const current = seen ?? emptySeen();
  return {
    movieIds: uniqueNumbers(current.movieIds, next.movieIds ?? []),
    showIds: uniqueNumbers(current.showIds, next.showIds ?? []),
    vibeIds: uniqueStrings(current.vibeIds, next.vibeIds ?? []),
  };
}

export function upsertLike(likes: GuestLike[], next: GuestLike) {
  const rest = likes.filter(
    (l) => !(l.tmdbId === next.tmdbId && l.mediaType === next.mediaType)
  );
  return [...rest, next];
}
