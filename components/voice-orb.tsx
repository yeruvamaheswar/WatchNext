"use client";

import { cn } from "@/lib/utils";
import type { OrbState } from "@/hooks/use-room-session";

export function VoiceOrb({ state }: { state: OrbState }) {
  const label =
    state === "listening"
      ? "Listening"
      : state === "thinking"
        ? "Thinking"
        : state === "speaking"
          ? "Speaking"
          : "Ready";

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative grid place-items-center">
        <div
          className={cn(
            "absolute size-56 rounded-full bg-violet-600/30 blur-2xl",
            state === "listening" && "animate-pulse",
            state === "speaking" && "animate-ping"
          )}
        />
        <div
          className={cn(
            "relative size-44 rounded-full bg-[radial-gradient(circle_at_30%_25%,#e9d5ff,transparent_45%),radial-gradient(circle_at_70%_80%,#6d28d9,transparent_50%),linear-gradient(180deg,#7c3aed,#3b0764)] shadow-[0_0_80px_rgba(124,58,237,0.55)]",
            state === "listening" && "scale-105 animate-pulse",
            state === "thinking" && "opacity-90",
            state === "speaking" && "scale-110"
          )}
        />
      </div>
      <p className="text-sm tracking-[0.25em] text-violet-200/80 uppercase">{label}</p>
    </div>
  );
}
