"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const EDGE_PX = 28;

/**
 * Stop iOS/PWA swipe-back from leaving the current screen.
 * Tab and in-app link navigation still work; only history-back is held.
 */
export function useBlockHistoryBack() {
  const pathname = usePathname();
  const hrefRef = useRef("");

  useEffect(() => {
    const href = window.location.href;
    hrefRef.current = href;
    window.history.pushState({ watchnextHold: true }, "", href);

    function hold() {
      window.history.pushState({ watchnextHold: true }, "", hrefRef.current);
    }

    window.addEventListener("popstate", hold, true);
    return () => {
      window.removeEventListener("popstate", hold, true);
    };
  }, [pathname]);

  useEffect(() => {
    let tracking = false;
    let startX = 0;
    let startY = 0;

    function onTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = startX <= EDGE_PX || startX >= window.innerWidth - EDGE_PX;
    }

    function onTouchMove(event: TouchEvent) {
      if (!tracking) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        event.preventDefault();
        return;
      }
      tracking = false;
    }

    function end() {
      tracking = false;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, []);
}

export function BlockSwipeNavigation() {
  useBlockHistoryBack();
  return null;
}
