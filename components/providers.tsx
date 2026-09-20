"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { WatchNextProvider } from "@/hooks/use-watchnext";
import { RoomUiProvider } from "@/hooks/use-room-ui";
import { PwaRegister } from "@/components/pwa-register";
import { SafeAreaSync } from "@/components/safe-area-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      <WatchNextProvider>
        <RoomUiProvider>
          {children}
          <Toaster theme="dark" position="bottom-center" />
          <PwaRegister />
          <SafeAreaSync />
        </RoomUiProvider>
      </WatchNextProvider>
    </ThemeProvider>
  );
}
