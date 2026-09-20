import { abortableFetch } from "@/lib/with-timeout";
import type { GuestLike, GuestState, LikeSource, MediaType, TitleMark, Verdict } from "@/lib/types";

export type RemoteUserState = {
  exists: boolean;
  displayName: string;
  onboardingComplete: boolean;
  likes: GuestLike[];
  likedVibes: string[];
  watchlist: TitleMark[];
  seen: TitleMark[];
};

export type PersistUserStateInput = {
  userId: string;
  displayName?: string;
  isGuest?: boolean;
  likes?: GuestLike[];
  likedVibes?: string[];
  watchlist?: TitleMark[];
  seen?: TitleMark[];
  onboardingComplete?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedUserId(id: string | null | undefined): id is string {
  return Boolean(id && UUID_RE.test(id));
}

function titleKey(item: { tmdbId: number; mediaType: string }) {
  return `${item.mediaType}:${item.tmdbId}`;
}

export function mergeLikes(remote: GuestLike[], local: GuestLike[]) {
  const map = new Map<string, GuestLike>();
  for (const like of remote) map.set(titleKey(like), like);
  for (const like of local) map.set(titleKey(like), like);
  return [...map.values()];
}

export function mergeMarks(remote: TitleMark[], local: TitleMark[]) {
  const map = new Map<string, TitleMark>();
  for (const mark of remote) map.set(titleKey(mark), mark);
  for (const mark of local) {
    const current = map.get(titleKey(mark));
    map.set(titleKey(mark), {
      ...current,
      ...mark,
      name: mark.name || current?.name,
    });
  }
  return [...map.values()];
}

export function hasLocalTaste(state: GuestState) {
  return (
    state.onboardingComplete ||
    state.likes.length > 0 ||
    state.likedVibes.length > 0 ||
    (state.displayName.trim() !== "" && state.displayName !== "Guest")
  );
}

export function shouldPushLocal(local: GuestState, remote: RemoteUserState | null) {
  if (!remote?.exists) return hasLocalTaste(local);
  if (local.onboardingComplete && !remote.onboardingComplete) return true;
  if (
    local.likes.some(
      (like) =>
        !remote.likes.some(
          (row) => row.tmdbId === like.tmdbId && row.mediaType === like.mediaType
        )
    )
  ) {
    return true;
  }
  if (local.likedVibes.some((vibe) => !remote.likedVibes.includes(vibe))) return true;
  if (
    local.watchlist.some(
      (mark) =>
        !remote.watchlist.some(
          (row) => row.tmdbId === mark.tmdbId && row.mediaType === mark.mediaType
        )
    )
  ) {
    return true;
  }
  if (
    local.seen.some(
      (mark) =>
        !remote.seen.some(
          (row) => row.tmdbId === mark.tmdbId && row.mediaType === mark.mediaType
        )
    )
  ) {
    return true;
  }
  return false;
}

export function mergeUserState(
  local: GuestState,
  remote: RemoteUserState | null,
  userId: string
): GuestState {
  const guestId = userId || local.guestId;
  if (!remote?.exists) {
    return {
      ...local,
      guestId,
      watchlist: local.watchlist ?? [],
      seen: local.seen ?? [],
    };
  }

  return {
    guestId,
    displayName: remote.displayName || local.displayName,
    onboardingComplete: remote.onboardingComplete || local.onboardingComplete,
    likes: mergeLikes(remote.likes, local.likes),
    likedVibes: [...new Set([...remote.likedVibes, ...local.likedVibes])],
    dislikedVibes: local.dislikedVibes,
    seenOnboarding: local.seenOnboarding,
    watchlist: mergeMarks(remote.watchlist, local.watchlist ?? []),
    seen: mergeMarks(remote.seen, local.seen ?? []),
  };
}

export function asMediaType(value: string): MediaType | null {
  return value === "movie" || value === "tv" ? value : null;
}

export function asVerdict(value: string): Verdict | null {
  return value === "like" || value === "dislike" ? value : null;
}

export function asLikeSource(value: string): LikeSource {
  return value === "favorite" ? "favorite" : "onboarding";
}

export async function fetchRemoteUserState(
  userId: string,
  timeoutMs: number
): Promise<RemoteUserState | null> {
  if (!isPersistedUserId(userId)) return null;
  const res = await abortableFetch(
    `/api/user/state?userId=${encodeURIComponent(userId)}`,
    {},
    timeoutMs
  );
  if (!res.ok) return null;
  return (await res.json()) as RemoteUserState;
}

export async function saveRemoteUserState(
  input: PersistUserStateInput,
  timeoutMs: number
) {
  if (!isPersistedUserId(input.userId)) return { ok: true, persisted: false };
  const res = await abortableFetch(
    "/api/user/state",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    timeoutMs
  );
  if (!res.ok) return { ok: false, persisted: false };
  return (await res.json()) as { ok: boolean; persisted: boolean };
}
