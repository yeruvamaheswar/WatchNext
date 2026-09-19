import { RecommendForm } from "@/components/RecommendForm";
import { GENRES, MOODS } from "@/lib/recommend";

export default function HomePage() {
  return (
    <main className="page-shell">
      <h1 className="brand">WatchNext</h1>
      <p className="lede">
        Tell us the vibe. We&apos;ll rank a short list from the WatchNext shelf
        and say why each one fits tonight.
      </p>
      <RecommendForm moods={MOODS} genres={GENRES} />
    </main>
  );
}
