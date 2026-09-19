"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomTabs } from "@/components/bottom-tabs";
import { BrandLogo } from "@/components/brand-logo";
import { HamburgerMenu } from "@/components/hamburger-menu";
import { useRoomUi } from "@/hooks/use-room-ui";
import { APP_TABS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { active } = useRoomUi();
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {!active ? (
        <header
          className="relative z-20 shrink-0 border-b border-white/5 px-2"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          {/* Blur on a sibling so it does not trap position:fixed (backdrop-filter containing block). */}
          <div className="pointer-events-none absolute inset-0 bg-[#0c0614]/80 backdrop-blur-xl" />
          <div className="relative flex items-center gap-2">
            <HamburgerMenu />
            <BrandLogo href="/home" />
            <nav className="ml-auto hidden items-center pr-3 md:flex">
              {APP_TABS.map((tab) => {
                const current = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "px-3 py-3 text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors",
                      current
                        ? "text-violet-200"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
      ) : null}
      <div
        className={cn(
          "min-h-0 flex-1",
          active ? "flex flex-col" : "overflow-y-auto pb-20 md:pb-0"
        )}
      >
        {children}
      </div>
      {!active ? <BottomTabs /> : null}
    </div>
  );
}
