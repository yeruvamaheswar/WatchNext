import Link from "next/link";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { mark: "size-7", type: "text-[15px]" },
  md: { mark: "size-8", type: "text-lg" },
  lg: { mark: "size-16", type: "text-2xl" },
} as const;

type BrandLogoProps = {
  size?: keyof typeof SIZES;
  wordmark?: boolean;
  href?: string;
  className?: string;
};

/** Stacked poster cards + a play skip — WatchNext's logomark. */
export function BrandMark({
  className,
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : "WatchNext"}
    >
      <rect
        x="15.6"
        y="6"
        width="20"
        height="22.8"
        rx="6.4"
        fill="#4c1d95"
      />
      <rect
        x="15.6"
        y="6"
        width="20"
        height="22.8"
        rx="6.4"
        stroke="#a78bfa"
        strokeOpacity="0.4"
        strokeWidth="0.75"
      />
      <rect x="4.4" y="11.2" width="20" height="22.8" rx="6.4" fill="#6d28d9" />
      <ellipse
        cx="10.4"
        cy="16.4"
        rx="6.8"
        ry="5.2"
        fill="#c084fc"
        fillOpacity="0.42"
      />
      <path
        d="M11.2 19.15c-.52-.32-1.2.05-1.2.66v6.38c0 .61.68.98 1.2.66l5.28-3.19c.48-.29.48-1.03 0-1.32l-5.28-3.19Z"
        fill="#f3e8ff"
      />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold tracking-tight whitespace-nowrap",
        className
      )}
    >
      <span className="text-violet-50">Watch</span>
      <span className="bg-gradient-to-r from-violet-300 to-violet-100 bg-clip-text text-transparent">
        Next
      </span>
    </span>
  );
}

export function BrandLogo({
  size = "sm",
  wordmark = true,
  href,
  className,
}: BrandLogoProps) {
  const scale = SIZES[size];
  const inner = (
    <>
      <BrandMark className={scale.mark} decorative={wordmark} />
      {wordmark ? <BrandWordmark className={scale.type} /> : null}
    </>
  );

  const shared = cn(
    "inline-flex items-center gap-2",
    href && "rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-violet-400/60",
    className
  );

  if (href) {
    return (
      <Link
        href={href}
        className={shared}
        aria-label="WatchNext"
      >
        {inner}
      </Link>
    );
  }

  return (
    <span className={shared} aria-label={wordmark ? undefined : "WatchNext"}>
      {inner}
    </span>
  );
}

export function BrandSplash({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0c0614]",
        className
      )}
    >
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-6 rounded-full bg-violet-600/30 blur-2xl"
        />
        <BrandMark
          decorative
          className="relative size-20 drop-shadow-[0_0_28px_rgba(124,58,237,0.55)]"
        />
      </div>
      <BrandWordmark className="text-xl tracking-[0.12em]" />
    </div>
  );
}
