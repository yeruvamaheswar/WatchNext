"use client";

import { cn } from "@/lib/utils";
import type { OrbState } from "@/hooks/use-room-session";

type OrbSize = "xs" | "sm" | "md";

const SIZE = {
  xs: {
    glow: "size-14",
    ring: "size-16",
    orb: "size-11",
    shadow: "shadow-[0_0_18px_rgba(124,58,237,0.45)]",
  },
  sm: {
    glow: "size-20",
    ring: "size-[5.25rem]",
    orb: "size-16",
    shadow: "shadow-[0_0_28px_rgba(124,58,237,0.5)]",
  },
  md: {
    glow: "size-40",
    ring: "size-[9.5rem]",
    orb: "size-32",
    shadow: "shadow-[0_0_56px_rgba(124,58,237,0.5)]",
  },
} as const;

export function VoiceOrb({
  state,
  size = "md",
  docked = false,
  hideLabel = false,
}: {
  state: OrbState;
  size?: OrbSize;
  docked?: boolean;
  hideLabel?: boolean;
}) {
  const label =
    state === "connecting"
      ? "Connecting"
      : state === "listening"
        ? "Listening"
        : state === "thinking"
          ? "Thinking"
          : state === "speaking"
            ? "Speaking"
            : "Ready";
  const box = SIZE[size];

  return (
    <div className={cn("flex flex-col items-center", hideLabel ? "gap-0" : "gap-1.5 md:gap-3")}>
      <div
        className={cn(
          "relative grid place-items-center",
          docked && "rounded-full ring-1 ring-white/20 md:p-0 md:ring-0",
          docked && (size === "xs" ? "p-px" : "p-0.5")
        )}
      >
        <div
          className={cn(
            "absolute rounded-full bg-violet-600/30 transition-opacity duration-300",
            size === "xs" ? "blur-md" : "blur-2xl",
            box.glow,
            state === "connecting" && "animate-pulse",
            state === "listening" && "animate-pulse",
            state === "speaking" && "animate-ping"
          )}
        />
        {state === "connecting" ? (
          <div
            className={cn(
              "absolute animate-spin rounded-full border-2 border-violet-200/20 border-t-violet-100",
              box.ring
            )}
          />
        ) : null}
        <div
          className={cn(
            "relative rounded-full bg-[radial-gradient(circle_at_30%_25%,#e9d5ff,transparent_45%),radial-gradient(circle_at_70%_80%,#6d28d9,transparent_50%),linear-gradient(180deg,#7c3aed,#3b0764)] transition-transform duration-300",
            box.orb,
            box.shadow,
            state === "connecting" && "scale-95 opacity-90",
            state === "listening" && "scale-105 animate-pulse",
            state === "thinking" && "opacity-90",
            state === "speaking" && "scale-110"
          )}
        />
      </div>
      {hideLabel ? (
        <span className="sr-only">{label}</span>
      ) : (
        <p className="text-[10px] font-medium tracking-[0.16em] text-violet-200/80 uppercase md:text-[11px]">
          {label}
        </p>
      )}
    </div>
  );
}
