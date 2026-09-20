"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomTabs } from "@/components/bottom-tabs";
import { HamburgerMenu } from "@/components/hamburger-menu";
import { useRoomUi } from "@/hooks/use-room-ui";
import { APP_TABS } from "@/lib/nav";
import { PWA_HEADER_PAD } from "@/lib/pwa";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { active } = useRoomUi();
  const pathname = usePathname();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      {!active ? (
        <header
          data-wn-header
          className="relative z-[210] shrink-0 bg-background px-2 pb-1"
          style={{ paddingTop: PWA_HEADER_PAD }}
        >
          <div className="relative flex items-center gap-2">
            <HamburgerMenu />
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
          active
            ? "flex flex-col"
            : "overflow-x-hidden overflow-y-auto pb-[calc(3.25rem+var(--wn-safe-bottom,0px))] scrollbar-none md:pb-0"
        )}
      >
        {children}
      </div>
      {!active ? <BottomTabs /> : null}
    </div>
  );
}
