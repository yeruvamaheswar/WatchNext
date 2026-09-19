"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandSplash } from "@/components/brand-logo";
import { useWatchNext } from "@/hooks/use-watchnext";

export function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, guest } = useWatchNext();

  useEffect(() => {
    if (!ready) return;
    if (!guest.onboardingComplete) router.replace("/onboarding");
  }, [guest.onboardingComplete, ready, router]);

  if (!ready || !guest.onboardingComplete) {
    return <BrandSplash />;
  }

  return children;
}
