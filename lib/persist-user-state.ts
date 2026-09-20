import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  asLikeSource,
  asMediaType,
  asVerdict,
  type RemoteUserState,
} from "@/lib/user-state";
import type { GuestLike, TitleMark } from "@/lib/types";

type LikeRow = {
  tmdb_id: number;
  media_type: string;
  verdict: string;
  source: string;
};

type MarkRow = {
  tmdb_id: number;
  media_type: string;
};

export async function loadPersistedUserState(userId: string): Promise<RemoteUserState> {
  const supabase = createAdminSupabase();
  const [profileRes, likesRes, watchlistRes, seenRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, liked_vibe_tags, onboarding_completed_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_likes")
      .select("tmdb_id, media_type, verdict, source")
      .eq("user_id", userId),
    supabase
      .from("user_watchlist")
      .select("tmdb_id, media_type")
      .eq("user_id", userId),
    supabase.from("user_seen").select("tmdb_id, media_type").eq("user_id", userId),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (likesRes.error) throw likesRes.error;
  if (watchlistRes.error) throw watchlistRes.error;
  if (seenRes.error) throw seenRes.error;

  const likesRaw = ((likesRes.data ?? []) as LikeRow[])
    .map((row) => {
      const mediaType = asMediaType(row.media_type);
      const verdict = asVerdict(row.verdict);
      if (!mediaType || !verdict) return null;
      return {
        tmdbId: row.tmdb_id,
        mediaType,
        verdict,
        source: asLikeSource(row.source),
      } satisfies GuestLike;
    })
    .filter((row): row is GuestLike => Boolean(row));
  const likeNames = await withTitleNames(
    likesRaw.map((like) => ({
      tmdbId: like.tmdbId,
      mediaType: like.mediaType,
    }))
  );
  const likeNameByKey = new Map(
    likeNames.map((mark) => [`${mark.mediaType}:${mark.tmdbId}`, mark.name])
  );
  const likes = likesRaw.map((like) => ({
    ...like,
    name: likeNameByKey.get(`${like.mediaType}:${like.tmdbId}`),
  }));

  const watchlist = await withTitleNames(
    ((watchlistRes.data ?? []) as MarkRow[])
      .map(toTitleMark)
      .filter((row): row is TitleMark => Boolean(row))
  );
  const seen = await withTitleNames(
    ((seenRes.data ?? []) as MarkRow[])
      .map(toTitleMark)
      .filter((row): row is TitleMark => Boolean(row))
  );

  if (!profileRes.data) {
    return {
      exists: likes.length > 0 || watchlist.length > 0 || seen.length > 0,
      displayName: "Guest",
      onboardingComplete: false,
      likes,
      likedVibes: [],
      watchlist,
      seen,
    };
  }

  return {
    exists: true,
    displayName: profileRes.data.display_name || "Guest",
    onboardingComplete: Boolean(profileRes.data.onboarding_completed_at),
    likes,
    likedVibes: Array.isArray(profileRes.data.liked_vibe_tags)
      ? profileRes.data.liked_vibe_tags.filter((tag: unknown): tag is string => typeof tag === "string")
      : [],
    watchlist,
    seen,
  };
}

export async function persistUserLists(input: {
  userId: string;
  displayName?: string;
  isGuest?: boolean;
  likes?: GuestLike[];
  likedVibes?: string[];
  watchlist?: TitleMark[];
  seen?: TitleMark[];
  onboardingComplete?: boolean;
}) {
  const supabase = createAdminSupabase();
  const profile: Record<string, unknown> = { id: input.userId };
  if (input.displayName !== undefined) profile.display_name = input.displayName;
  if (input.isGuest !== undefined) profile.is_guest = input.isGuest;
  if (input.likedVibes !== undefined) profile.liked_vibe_tags = input.likedVibes;
  if (input.onboardingComplete === true) {
    profile.onboarding_completed_at = new Date().toISOString();
  } else if (input.onboardingComplete === false) {
    profile.onboarding_completed_at = null;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" });
  if (profileError) throw profileError;

  if (input.likes) {
    await replaceLikes(input.userId, input.likes);
  }
  if (input.watchlist) {
    await replaceMarks("user_watchlist", input.userId, input.watchlist);
  }
  if (input.seen) {
    await replaceMarks("user_seen", input.userId, input.seen);
  }

  return { persisted: true };
}

async function replaceLikes(userId: string, likes: GuestLike[]) {
  const supabase = createAdminSupabase();
  const { data: existing, error: readError } = await supabase
    .from("user_likes")
    .select("id, tmdb_id, media_type")
    .eq("user_id", userId);
  if (readError) throw readError;

  const nextKeys = new Set(likes.map((like) => `${like.mediaType}:${like.tmdbId}`));
  const staleIds = (existing ?? [])
    .filter((row) => !nextKeys.has(`${row.media_type}:${row.tmdb_id}`))
    .map((row) => row.id);
  if (staleIds.length) {
    const { error } = await supabase.from("user_likes").delete().in("id", staleIds);
    if (error) throw error;
  }

  if (!likes.length) return;
  const { error } = await supabase.from("user_likes").upsert(
    likes.map((like) => ({
      user_id: userId,
      tmdb_id: like.tmdbId,
      media_type: like.mediaType,
      verdict: like.verdict,
      source: like.source,
    })),
    { onConflict: "user_id,tmdb_id,media_type" }
  );
  if (error) throw error;
}

async function replaceMarks(
  table: "user_watchlist" | "user_seen",
  userId: string,
  marks: TitleMark[]
) {
  const supabase = createAdminSupabase();
  const { data: existing, error: readError } = await supabase
    .from(table)
    .select("id, tmdb_id, media_type")
    .eq("user_id", userId);
  if (readError) throw readError;

  const nextKeys = new Set(marks.map((mark) => `${mark.mediaType}:${mark.tmdbId}`));
  const staleIds = (existing ?? [])
    .filter((row) => !nextKeys.has(`${row.media_type}:${row.tmdb_id}`))
    .map((row) => row.id);
  if (staleIds.length) {
    const { error } = await supabase.from(table).delete().in("id", staleIds);
    if (error) throw error;
  }

  if (!marks.length) return;
  const { error } = await supabase.from(table).upsert(
    marks.map((mark) => ({
      user_id: userId,
      tmdb_id: mark.tmdbId,
      media_type: mark.mediaType,
    })),
    { onConflict: "user_id,tmdb_id,media_type" }
  );
  if (error) throw error;
}

function toTitleMark(row: MarkRow): TitleMark | null {
  const mediaType = asMediaType(row.media_type);
  if (!mediaType) return null;
  return { tmdbId: row.tmdb_id, mediaType };
}

async function withTitleNames(marks: TitleMark[]): Promise<TitleMark[]> {
  if (!marks.length) return marks;
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from("titles")
    .select("tmdb_id, media_type, name")
    .in(
      "tmdb_id",
      marks.map((mark) => mark.tmdbId)
    );
  const names = new Map(
    (data ?? []).map((row) => [`${row.media_type}:${row.tmdb_id}`, row.name as string])
  );
  return marks.map((mark) => ({
    ...mark,
    name: names.get(`${mark.mediaType}:${mark.tmdbId}`) || mark.name,
  }));
}
