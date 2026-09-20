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
  watchlist: [],
  seen: [],
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
    watchlist: [],
    seen: [],
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
      watchlist: parsed.watchlist ?? [],
      seen: parsed.seen ?? [],
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

export function removeLike(
  likes: GuestLike[],
  mark: { tmdbId: number; mediaType: GuestLike["mediaType"] }
) {
  return likes.filter(
    (like) => !(like.tmdbId === mark.tmdbId && like.mediaType === mark.mediaType)
  );
}

export function isLikedTitle(
  likes: GuestLike[],
  mark: { tmdbId: number; mediaType: GuestLike["mediaType"] }
) {
  return likes.some(
    (like) =>
      like.tmdbId === mark.tmdbId &&
      like.mediaType === mark.mediaType &&
      like.verdict === "like"
  );
}

export function hasMark(
  marks: { tmdbId: number; mediaType: GuestLike["mediaType"] }[] | undefined,
  next: { tmdbId: number; mediaType: GuestLike["mediaType"] }
) {
  return (marks ?? []).some(
    (mark) => mark.tmdbId === next.tmdbId && mark.mediaType === next.mediaType
  );
}

export function dropMark(
  marks: { tmdbId: number; mediaType: GuestLike["mediaType"] }[] | undefined,
  next: { tmdbId: number; mediaType: GuestLike["mediaType"] }
) {
  return (marks ?? []).filter(
    (mark) => !(mark.tmdbId === next.tmdbId && mark.mediaType === next.mediaType)
  );
}

export function toggleMark<T extends { tmdbId: number; mediaType: GuestLike["mediaType"] }>(
  marks: T[] | undefined,
  next: T
) {
  const current = marks ?? [];
  if (hasMark(current, next)) return dropMark(current, next) as T[];
  return [...current, next];
}
