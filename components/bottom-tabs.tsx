"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TABS } from "@/lib/nav";
import { PWA_FOOTER_PAD } from "@/lib/pwa";
import { cn } from "@/lib/utils";

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-transparent md:hidden">
      <div className="relative mx-auto max-w-lg">
        <ul className="grid grid-cols-[1fr_4.5rem_1fr]">
          {APP_TABS.map((tab) => {
            const current = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <li key={tab.href} className={tab.href === "/room" ? "col-start-3" : undefined}>
                <Link
                  href={tab.href}
                  className={cn(
                    "pointer-events-auto flex flex-col items-center justify-end gap-0.5 pt-1.5 text-[11px] [text-shadow:0_1px_8px_rgba(10,4,20,0.85)]",
                    current ? "text-violet-300" : "text-muted-foreground"
                  )}
                  style={{
                    paddingBottom: PWA_FOOTER_PAD,
                  }}
                >
                  <Icon className={cn("size-5", current && "fill-violet-400/30")} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div
          id="wn-tab-dock"
          className="pointer-events-none absolute inset-x-0 bottom-[calc(1.05rem+var(--wn-safe-bottom,0px))] z-40 flex justify-center"
        />
      </div>
    </nav>
  );
}
