import { handleRouteError } from "@/lib/errors";
import { recommend } from "@/lib/recommend";
import { requireOpenAI } from "@/lib/env";
import type { RecommendInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireOpenAI();
    const body = (await request.json()) as RecommendInput;
    const result = await recommend(body);
    return Response.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
