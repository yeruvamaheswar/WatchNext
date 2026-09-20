"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandSplash } from "@/components/brand-logo";
import { useWatchNext } from "@/hooks/use-watchnext";

let shellUnlocked = false;

export function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, guest } = useWatchNext();

  if (ready) {
    shellUnlocked = guest.onboardingComplete;
  }

  useEffect(() => {
    if (!ready) return;
    if (!guest.onboardingComplete) router.replace("/onboarding");
  }, [guest.onboardingComplete, ready, router]);

  if (!shellUnlocked) {
    return <BrandSplash />;
  }

  return children;
}
