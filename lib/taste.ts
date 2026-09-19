import { embedText, meanVectors, titleEmbedText } from "@/lib/embeddings";
import { VIBE_CARDS } from "@/lib/onboarding-catalog";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { GuestLike } from "@/lib/types";

export async function recomputeTaste(input: {
  userId: string;
  likes: GuestLike[];
  likedVibes: string[];
  displayName?: string;
  isGuest?: boolean;
}) {
  const supabase = createAdminSupabase();
  await supabase.from("profiles").upsert(
    {
      id: input.userId,
      display_name: input.displayName ?? "Guest",
      liked_vibe_tags: input.likedVibes,
      is_guest: input.isGuest ?? true,
      onboarding_completed_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const rows = input.likes.map((like) => ({
    user_id: input.userId,
    tmdb_id: like.tmdbId,
    media_type: like.mediaType,
    verdict: like.verdict,
    source: like.source,
  }));
  if (rows.length) {
    await supabase.from("user_likes").upsert(rows, {
      onConflict: "user_id,tmdb_id,media_type",
    });
  }

  const liked = input.likes.filter((l) => l.verdict === "like");
  const vectors: number[][] = [];

  if (liked.length) {
    const { data: titles } = await supabase
      .from("titles")
      .select("id, tmdb_id")
      .in(
        "tmdb_id",
        liked.map((l) => l.tmdbId)
      );
    const ids = (titles ?? []).map((t) => t.id);
    if (ids.length) {
      const { data: embeddings } = await supabase
        .from("title_embeddings")
        .select("embedding")
        .in("title_id", ids);
      for (const row of embeddings ?? []) {
        if (Array.isArray(row.embedding)) vectors.push(row.embedding);
      }
    }
  }

  if (input.likedVibes.length) {
    const prompts = input.likedVibes.map((id) => {
      const vibe = VIBE_CARDS.find((v) => v.id === id);
      return vibe ? titleEmbedText({ name: vibe.name, overview: vibe.prompt }) : id;
    });
    for (const prompt of prompts) {
      vectors.push(await embedText(prompt));
    }
  }

  const taste = meanVectors(vectors);
  if (taste) {
    await supabase
      .from("profiles")
      .update({ taste_embedding: taste })
      .eq("id", input.userId);
  }

  return { vectorCount: vectors.length };
}
