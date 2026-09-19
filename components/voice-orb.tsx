"use client";

import { cn } from "@/lib/utils";
import type { OrbState } from "@/hooks/use-room-session";

type OrbSize = "sm" | "md";

const SIZE = {
  sm: {
    glow: "size-24",
    ring: "size-[6.25rem]",
    orb: "size-20",
    shadow: "shadow-[0_0_36px_rgba(124,58,237,0.5)]",
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
}: {
  state: OrbState;
  size?: OrbSize;
  docked?: boolean;
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
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          "relative grid place-items-center",
          docked && "rounded-full p-1 ring-1 ring-white/20 md:p-0 md:ring-0"
        )}
      >
        <div
          className={cn(
            "absolute rounded-full bg-violet-600/30 blur-2xl transition-opacity duration-300",
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
      <p className="text-[11px] font-medium tracking-[0.16em] text-violet-200/80 uppercase">
        {label}
      </p>
    </div>
  );
}
