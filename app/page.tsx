"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandSplash } from "@/components/brand-logo";
import { useWatchNext } from "@/hooks/use-watchnext";

export default function GatePage() {
  const router = useRouter();
  const { ready, guest } = useWatchNext();

  useEffect(() => {
    if (!ready) return;
    router.replace(guest.onboardingComplete ? "/home" : "/onboarding");
  }, [guest.onboardingComplete, ready, router]);

  return <BrandSplash />;
}
