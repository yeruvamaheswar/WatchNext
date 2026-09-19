"use server";

import { recommend, type RecommendInput, type RecommendResult } from "@/lib/recommend";

export async function getRecommendations(
  input: RecommendInput,
): Promise<RecommendResult> {
  return recommend(input);
}
