import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WatchNext",
    short_name: "WatchNext",
    description: "Swipe your taste. Get a watch-now pick. Talk it out in a room.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0614",
    theme_color: "#6d28d9",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
