"use client";

import { useEffect, useState } from "react";
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

type Gaze = { x: number; y: number; ms: number };

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function nextGaze(state: OrbState): Gaze {
  const energetic = state === "listening" || state === "speaking";
  const range = energetic ? 26 : state === "thinking" ? 20 : 16;
  const yBias = state === "thinking" ? -8 : energetic ? -4 : -2;
  return {
    x: rand(-range, range),
    y: rand(-range * 0.85, range * 0.7) + yBias,
    ms: energetic ? rand(180, 480) : state === "connecting" ? rand(280, 600) : rand(350, 900),
  };
}

function nextDelay(state: OrbState) {
  if (state === "listening") return rand(120, 420);
  if (state === "speaking") return rand(200, 550);
  if (state === "connecting") return rand(280, 700);
  if (state === "thinking") return rand(400, 1100);
  return rand(600, 1800);
}

function useRandomGaze(state: OrbState) {
  const [gaze, setGaze] = useState<Gaze>({ x: 0, y: -4, ms: 400 });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setGaze({ x: 0, y: -4, ms: 0 });
      return;
    }

    let cancelled = false;
    let gazeTimer = 0;
    let blinkTimer = 0;
    let blinkReset = 0;

    const scheduleGaze = () => {
      gazeTimer = window.setTimeout(() => {
        if (cancelled) return;
        setGaze(nextGaze(state));
        scheduleGaze();
      }, nextDelay(state));
    };

    const scheduleBlink = () => {
      const wait =
        state === "listening"
          ? rand(1800, 4000)
          : state === "connecting"
            ? rand(900, 2200)
            : rand(1400, 3600);
      blinkTimer = window.setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        blinkReset = window.setTimeout(() => {
          if (!cancelled) setBlink(false);
        }, rand(70, 130));
        if (Math.random() < 0.28) {
          window.setTimeout(() => {
            if (cancelled) return;
            setBlink(true);
            window.setTimeout(() => {
              if (!cancelled) setBlink(false);
            }, rand(60, 110));
          }, rand(140, 220));
        }
        scheduleBlink();
      }, wait);
    };

    setGaze(nextGaze(state));
    scheduleGaze();
    scheduleBlink();

    return () => {
      cancelled = true;
      window.clearTimeout(gazeTimer);
      window.clearTimeout(blinkTimer);
      window.clearTimeout(blinkReset);
    };
  }, [state]);

  return { gaze, blink };
}

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
  const { gaze, blink } = useRandomGaze(state);

  return (
    <div
      className={cn(
        "flex flex-col items-center",
        hideLabel ? "gap-0" : "gap-1.5 md:gap-3"
      )}
    >
      <style>{ORB_FACE_CSS}</style>
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
          data-state={state}
          className={cn(
            "orb-face relative overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_25%,#e9d5ff,transparent_45%),radial-gradient(circle_at_70%_80%,#6d28d9,transparent_50%),linear-gradient(180deg,#7c3aed,#3b0764)] transition-transform duration-300",
            box.orb,
            box.shadow,
            state === "connecting" && "scale-95 opacity-90",
            state === "listening" && "scale-105",
            state === "thinking" && "opacity-90",
            state === "speaking" && "scale-110"
          )}
        >
          <div
            className="orb-gaze"
            aria-hidden
            style={{
              transform: `translate(-50%, -50%) translate(${gaze.x}%, ${gaze.y}%)`,
              transitionDuration: `${gaze.ms}ms`,
            }}
          >
            <span className={cn("orb-capsule", blink && "orb-capsule-blink")} />
            <span className={cn("orb-capsule", blink && "orb-capsule-blink")} />
          </div>
        </div>
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

const ORB_FACE_CSS = `
.orb-face .orb-gaze {
  position: absolute;
  left: 50%;
  top: 42%;
  display: flex;
  gap: 18%;
  align-items: center;
  justify-content: center;
  width: 42%;
  height: 28%;
  transform: translate(-50%, -50%);
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.22, 0.8, 0.28, 1);
  will-change: transform;
}

.orb-face .orb-capsule {
  display: block;
  width: 28%;
  height: 100%;
  border-radius: 999px;
  background: #0a0a0a;
  transform-origin: center;
  transform: scaleY(1);
  transition: transform 70ms ease-in;
  will-change: transform;
}

.orb-face .orb-capsule-blink {
  transform: scaleY(0.1);
  transition-duration: 55ms;
}

.orb-face[data-state="listening"] {
  animation: orb-bob 0.7s ease-in-out infinite;
}

.orb-face[data-state="speaking"] {
  animation: orb-speak-bob 0.45s ease-in-out infinite;
}

@keyframes orb-bob {
  0%, 100% { transform: translateY(0) scale(1.05); }
  50% { transform: translateY(-4%) scale(1.08); }
}

@keyframes orb-speak-bob {
  0%, 100% { transform: translateY(0) scale(1.1); }
  50% { transform: translateY(-2.5%) scale(1.13); }
}

@media (prefers-reduced-motion: reduce) {
  .orb-face {
    animation: none !important;
  }
  .orb-face .orb-gaze {
    transition: none !important;
  }
}
`;
