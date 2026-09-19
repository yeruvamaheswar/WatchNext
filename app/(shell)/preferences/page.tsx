"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWatchNext } from "@/hooks/use-watchnext";
import { primaryActionClass } from "@/lib/button-styles";

export default function PreferencesPage() {
  const router = useRouter();
  const { resetOnboarding, guest } = useWatchNext();

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
      <div>
        <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">
          Preferences
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Taste controls</h1>
      </div>
      <section className="rounded-2xl border border-white/10 p-4">
        <h2 className="font-medium">Favorites, watchlist, seen-it</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Coming soon. Tables exist locally; this screen is a stub for v1.
        </p>
      </section>
      <section className="rounded-2xl border border-white/10 p-4">
        <h2 className="font-medium">Liked vibes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {guest.likedVibes.length
            ? guest.likedVibes.join(", ")
            : "None yet — redo onboarding to set them."}
        </p>
      </section>
      <Button
        type="button"
        className={`w-full ${primaryActionClass}`}
        onClick={() => {
          resetOnboarding();
          router.push("/onboarding");
        }}
      >
        Redo onboarding
      </Button>
    </main>
  );
}
