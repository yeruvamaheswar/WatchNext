"use client";

import { cn } from "@/lib/utils";

export function WatchOrb({
  loading = false,
  compact = false,
  onClick,
}: {
  loading?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-busy={loading}
      disabled={loading}
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50",
        compact ? "gap-4" : "gap-14",
        loading ? "cursor-wait" : "cursor-pointer"
      )}
    >
      <style>{WATCH_ORB_CSS}</style>
      <span
        className={cn(
          "tracking-[0.18em] text-white",
          compact ? "text-[10px]" : "text-[11px]"
        )}
      >
        What should I watch?
      </span>
      <span
        className={cn(
          "relative grid place-items-center transition-transform duration-200",
          !loading && "group-hover:scale-[1.03]"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "watch-haze pointer-events-none absolute rounded-full bg-violet-500/25",
            compact ? "size-20 blur-lg" : "size-52 blur-3xl"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute rounded-full bg-violet-600/40",
            compact ? "size-14 blur-md" : "size-40 blur-2xl",
            loading && "animate-pulse"
          )}
        />
        {loading ? (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute animate-spin rounded-full border-2 border-violet-200/20 border-t-violet-100",
              compact ? "size-16" : "size-[9.5rem]"
            )}
          />
        ) : null}
        <span
          className={cn(
            "relative grid place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_25%,#e9d5ff,transparent_45%),radial-gradient(circle_at_70%_80%,#6d28d9,transparent_50%),linear-gradient(180deg,#7c3aed,#3b0764)] transition-transform duration-300",
            compact
              ? "size-16 shadow-[0_0_34px_rgba(124,58,237,0.58)]"
              : "size-32 shadow-[0_0_64px_rgba(124,58,237,0.58)]",
            loading && "scale-95 opacity-90"
          )}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={cn(
              "translate-x-[8%] fill-violet-50 drop-shadow-[0_2px_8px_rgba(237,233,254,0.35)]",
              compact ? "size-7" : "size-14"
            )}
          >
            <path d="M8.2 5.7c-.86-.52-1.95.1-1.95 1.1v10.4c0 1 .1 1.62 1.95 1.1l8.55-5.2c.8-.48.8-1.72 0-2.2L8.2 5.7Z" />
          </svg>
        </span>
      </span>
    </button>
  );
}

const WATCH_ORB_CSS = `
.watch-haze {
  animation: watch-haze 4.8s ease-in-out infinite;
}

@keyframes watch-haze {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .watch-haze {
    animation: none !important;
  }
}
`;
