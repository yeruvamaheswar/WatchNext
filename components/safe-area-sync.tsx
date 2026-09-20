"use client";

import { useEffect } from "react";

function readInset(side: "top" | "bottom") {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  const prop = side === "top" ? "paddingTop" : "paddingBottom";
  const inset = side === "top" ? "safe-area-inset-top" : "safe-area-inset-bottom";
  el.style[prop] = `env(${inset}, 0px)`;
  document.body.appendChild(el);
  const raw = getComputedStyle(el)[prop];
  el.remove();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function isIosStandalone() {
  const ios =
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return ios && standalone;
}

/** Turn iOS env() + viewport chrome into CSS vars without double-counting. */
function resolveInsets() {
  const envTop = readInset("top");
  const envBottom = readInset("bottom");
  const gap = Math.max(0, window.screen.height - window.innerHeight);

  let top = envTop;
  let bottom = envBottom;

  // Layout viewport already reserved both insets (env() + dvh/inset-0).
  if (envTop > 0 && envBottom > 0 && gap >= envTop + envBottom - 8) {
    return { top: 0, bottom: 0 };
  }

  // Opaque status bar already pushed the webview down.
  if (envTop > 0 && gap >= envTop - 4) {
    top = 0;
  }

  if (!isIosStandalone()) return { top, bottom };

  // Standalone first paint: env() is often 0 until a resize.
  if (gap < 16) {
    if (top === 0) top = 47;
    if (bottom === 0) bottom = 34;
  } else if (bottom === 0 && gap >= 40 && gap <= 72) {
    bottom = 34;
  }

  return { top, bottom };
}

function apply() {
  const { top, bottom } = resolveInsets();
  const root = document.documentElement;
  root.style.setProperty("--wn-safe-top", `${top}px`);
  root.style.setProperty("--wn-safe-bottom", `${bottom}px`);
}

export function SafeAreaSync() {
  useEffect(() => {
    apply();
    const t1 = window.setTimeout(apply, 50);
    const t2 = window.setTimeout(apply, 400);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.visualViewport?.addEventListener("resize", apply);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, []);
  return null;
}
