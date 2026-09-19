"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/room", label: "Room", icon: Mic },
];

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0c0614]/90 backdrop-blur-xl"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-xs",
                  active ? "text-violet-300" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("size-5", active && "fill-violet-400/30")} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
