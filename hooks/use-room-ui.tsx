"use client";

import { createContext, useContext, useMemo, useState } from "react";

type RoomUi = {
  active: boolean;
  setActive: (active: boolean) => void;
};

const RoomUiContext = createContext<RoomUi | null>(null);

export function RoomUiProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <RoomUiContext.Provider value={value}>{children}</RoomUiContext.Provider>;
}

export function useRoomUi() {
  const ctx = useContext(RoomUiContext);
  if (!ctx) throw new Error("useRoomUi must be used within RoomUiProvider");
  return ctx;
}
