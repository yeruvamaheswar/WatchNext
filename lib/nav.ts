import { Home, Mic } from "lucide-react";

export const APP_TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/room", label: "Room", icon: Mic },
] as const;
