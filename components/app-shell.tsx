"use client";

import { BottomTabs } from "@/components/bottom-tabs";
import { HamburgerMenu } from "@/components/hamburger-menu";
import { useRoomUi } from "@/hooks/use-room-ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { active } = useRoomUi();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {!active ? (
        <header
          className="relative sticky top-0 z-20 border-b border-white/5 px-2"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          {/* Blur on a sibling so it does not trap position:fixed (backdrop-filter containing block). */}
          <div className="pointer-events-none absolute inset-0 bg-[#0c0614]/80 backdrop-blur-xl" />
          <div className="relative flex items-center gap-2">
            <HamburgerMenu />
            <p className="text-sm font-medium tracking-wide">WatchNext</p>
          </div>
        </header>
      ) : null}
      <div className={active ? "flex-1" : "flex-1 pb-20"}>{children}</div>
      {!active ? <BottomTabs /> : null}
    </div>
  );
}
