"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function MobileOrbDock({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById("wn-tab-dock"));
  }, []);

  if (!host) return null;

  return createPortal(
    <div className="flex w-fit flex-col items-center gap-1">{children}</div>,
    host
  );
}
