"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, SlidersHorizontal, UserRound, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchNext } from "@/hooks/use-watchnext";

const links = [
  { href: "/preferences", icon: SlidersHorizontal, label: "Preferences" },
  { href: "/user", icon: UserRound, label: "User" },
  { href: "/account", icon: Settings, label: "Account settings" },
];

export function HamburgerMenu() {
  const { guest, isGuest } = useWatchNext();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const drawer =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[200]"
            data-testid="hamburger-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Dismiss menu"
              onClick={() => setOpen(false)}
            />
            <aside
              className="absolute inset-y-0 left-0 z-[1] flex w-[min(20rem,86vw)] flex-col border-r border-white/10 bg-[#12081c] shadow-2xl"
              style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
            >
              <div className="flex items-start justify-between gap-3 px-5 pb-4">
                <div>
                  <p className="text-lg font-semibold">WatchNext</p>
                  <p className="text-sm text-muted-foreground">
                    {guest.displayName} · {isGuest ? "Guest" : "Signed in"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>
              <nav className="flex flex-col gap-1 px-2">
                {links.map((link) => {
                  const Icon = link.icon;
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm hover:bg-white/5 ${active ? "bg-white/10 text-violet-200" : ""}`}
                    >
                      <Icon className="size-4 text-violet-300" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="relative z-[90] size-11 rounded-full"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        data-testid="open-menu"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>
      {drawer}
    </>
  );
}
