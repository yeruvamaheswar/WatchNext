import catalogData from "@/data/catalog.json";
import type {
  CatalogItem,
  RecommendInput,
  RecommendProvider,
  RecommendResult,
  RankedRecommendation,
} from "@/lib/types";

export type {
  CatalogItem,
  RecommendInput,
  RecommendProvider,
  RecommendResult,
  RankedRecommendation,
} from "@/lib/types";

const catalog = catalogData as CatalogItem[];

export const MOODS = Array.from(
  new Set(catalog.flatMap((item) => item.moods)),
).sort();

export const GENRES = Array.from(
  new Set(catalog.flatMap((item) => item.genres)),
).sort();

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseFavorites(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/[\n,;|/]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function scoreItem(
  item: CatalogItem,
  mood: string,
  genre: string,
  favorites: string[],
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (mood) {
    const moodHit = item.moods.some((m) => m.toLowerCase() === mood);
    if (moodHit) {
      score += 5;
      reasons.push(`matches a ${item.moods.find((m) => m.toLowerCase() === mood)} mood`);
    } else {
      const soft = item.moods.some(
        (m) => m.toLowerCase().includes(mood) || mood.includes(m.toLowerCase()),
      );
      if (soft) {
        score += 2;
        reasons.push("close on mood");
      }
    }
  }

  if (genre) {
    const genreHit = item.genres.some((g) => g.toLowerCase() === genre);
    if (genreHit) {
      score += 4;
      reasons.push(`lands in ${item.genres.find((g) => g.toLowerCase() === genre)}`);
    }
  }

  for (const fav of favorites) {
    const title = item.title.toLowerCase();
    if (title === fav || title.includes(fav) || fav.includes(title)) {
      score += 3;
      reasons.push(`echoes a favorite you named`);
      break;
    }
    const genreOverlap = item.genres.some((g) => g.toLowerCase() === fav);
    const moodOverlap = item.moods.some((m) => m.toLowerCase() === fav);
    if (genreOverlap || moodOverlap) {
      score += 1.5;
      reasons.push(`neighbors something you already love`);
      break;
    }
    const overviewHit = item.overview.toLowerCase().includes(fav) && fav.length > 3;
    if (overviewHit) {
      score += 1;
      reasons.push(`shares DNA with your picks`);
      break;
    }
  }

  // Slight freshness bias so ties feel intentional
  score += Math.min(1, (item.year - 1990) / 40) * 0.2;

  return { score, reasons };
}

function whyLine(item: CatalogItem, reasons: string[]): string {
  if (reasons.length === 0) {
    return `${item.title} is a solid pick from the WatchNext shelf tonight.`;
  }
  const primary = reasons[0];
  const secondary = reasons[1];
  if (secondary) {
    return `${item.title} ${primary} and ${secondary}.`;
  }
  return `${item.title} ${primary}.`;
}

function emptyFallback(message: string): RecommendResult {
  return {
    recommendations: [],
    message,
    source: "catalog",
  };
}

/** Local catalog scorer — default working path today. */
export function recommendFromCatalog(input: RecommendInput): RecommendResult {
  try {
    const mood = normalize(input.mood);
    const genre = normalize(input.genre);
    const favorites = parseFavorites(input.favoritesText);

    if (!mood && !genre && favorites.length === 0) {
      return emptyFallback(
        "Pick a mood or genre—or drop a couple of favorites—and WatchNext will line up 1–3 picks.",
      );
    }

    const knownMood = !mood || MOODS.some((m) => m.toLowerCase() === mood);
    const knownGenre = !genre || GENRES.some((g) => g.toLowerCase() === genre);

    if (!knownMood && !knownGenre && favorites.length === 0) {
      return emptyFallback(
        "That combo is a little off-menu. Try a listed mood or genre, or name a favorite title.",
      );
    }

    const ranked: RankedRecommendation[] = catalog
      .map((item) => {
        const { score, reasons } = scoreItem(item, mood, genre, favorites);
        return {
          item,
          score,
          why: whyLine(item, reasons),
        };
      })
      .filter((row) => row.score >= 2)
      .sort((a, b) => b.score - a.score || b.item.year - a.item.year)
      .slice(0, 3);

    if (ranked.length === 0) {
      // Soft fallback: best near-misses so the UI still feels alive
      const soft = catalog
        .map((item) => {
          const { score, reasons } = scoreItem(item, mood, genre, favorites);
          return { item, score: score + 0.01, why: whyLine(item, reasons) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      if (soft.length === 0) {
        return emptyFallback(
          "Nothing lined up cleanly—try another mood, or leave favorites blank for a broader sweep.",
        );
      }

      return {
        recommendations: soft,
        message: "Close enough: a couple of near-matches from the local shelf.",
        source: "catalog",
      };
    }

    return {
      recommendations: ranked,
      source: "catalog",
    };
  } catch {
    return emptyFallback(
      "Something wobbled while ranking—refresh and try a simpler mood + genre combo.",
    );
  }
}

/**
 * Future TMDB MCP / API path.
 * Throws until wired; `recommend()` never calls this unless the provider is selected
 * and credentials exist — so the homepage keeps working offline today.
 */
export async function recommendFromTmdb(
  _input: RecommendInput,
): Promise<RecommendResult> {
  throw new Error(
    "TMDB provider is not configured yet. Set RECOMMEND_PROVIDER=catalog (default) until an open-source TMDB MCP / API token is connected.",
  );
}

const catalogProvider: RecommendProvider = {
  id: "catalog",
  recommend: recommendFromCatalog,
};

const tmdbProvider: RecommendProvider = {
  id: "tmdb",
  recommend: recommendFromTmdb,
};

/**
 * Active provider. Default is local catalog.
 * Flip with RECOMMEND_PROVIDER=tmdb once MCP/API is available — page code stays the same.
 */
export function getRecommendProvider(): RecommendProvider {
  const raw = (process.env.RECOMMEND_PROVIDER ?? "catalog").toLowerCase();
  if (raw === "tmdb") return tmdbProvider;
  return catalogProvider;
}

/**
 * Public entry used by the homepage / server actions.
 * Always returns a friendly RecommendResult — never throws to the UI.
 */
export async function recommend(input: RecommendInput): Promise<RecommendResult> {
  const provider = getRecommendProvider();
  try {
    const result = await provider.recommend(input);
    return result;
  } catch {
    // If a future TMDB path fails, fall back to catalog so the loop stays demo-safe.
    if (provider.id !== "catalog") {
      const fallback = recommendFromCatalog(input);
      return {
        ...fallback,
        message:
          fallback.message ??
          "Live TMDB suggestions are offline—showing local WatchNext shelf picks instead.",
      };
    }
    return emptyFallback(
      "Could not build recommendations right now. Try again with a mood or genre.",
    );
  }
}
