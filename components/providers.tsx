"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { WatchNextProvider } from "@/hooks/use-watchnext";
import { RoomUiProvider } from "@/hooks/use-room-ui";
import { PwaRegister } from "@/components/pwa-register";
import { SafeAreaSync } from "@/components/safe-area-sync";
import { BlockSwipeNavigation } from "@/hooks/use-block-history-back";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      <WatchNextProvider>
        <RoomUiProvider>
          {children}
          <Toaster
            theme="dark"
            position="top-center"
            offset={{ top: "calc(3.75rem + var(--wn-safe-top, 0px))" }}
            mobileOffset={{ top: "calc(3.75rem + var(--wn-safe-top, 0px))" }}
          />
          <PwaRegister />
          <SafeAreaSync />
          <BlockSwipeNavigation />
        </RoomUiProvider>
      </WatchNextProvider>
    </ThemeProvider>
  );
}
