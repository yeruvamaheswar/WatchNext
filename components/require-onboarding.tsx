"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWatchNext } from "@/hooks/use-watchnext";

export function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, guest } = useWatchNext();

  useEffect(() => {
    if (!ready) return;
    if (!guest.onboardingComplete) router.replace("/onboarding");
  }, [guest.onboardingComplete, ready, router]);

  if (!ready || !guest.onboardingComplete) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0c0614]">
        <div className="size-16 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ddd6fe,#6d28d9)] shadow-[0_0_40px_rgba(124,58,237,0.6)]" />
        <p className="text-sm tracking-[0.3em] text-violet-200 uppercase">WatchNext</p>
      </div>
    );
  }

  return children;
}
