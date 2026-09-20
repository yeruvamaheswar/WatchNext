import type { NextConfig } from "next";
import { networkInterfaces } from "os";

function extraOriginsFromEnv() {
  return (process.env.ALLOWED_DEV_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function localLanHostnames() {
  const hosts = new Set<string>();
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.internal) continue;
      const host = addr.address.split("%")[0];
      if (host) hosts.add(host);
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  output: "standalone",
  // 127.0.0.1 vs localhost is treated as cross-origin in Next 16.
  // `*.*.*.*` matches any IPv4 the browser uses (phones/PCs on the LAN).
  // Interface addresses cover IPv6 and stay current across DHCP.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "0.0.0.0",
    "*.*.*.*",
    ...localLanHostnames(),
    ...extraOriginsFromEnv(),
  ],
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/apple-touch-icon.png",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
      {
        source: "/apple-touch-icon-precomposed.png",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
      {
        source: "/apple-touch-icon-:size.png",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/apple-icon", destination: "/apple-touch-icon.png" },
      { source: "/apple-icon.png", destination: "/apple-touch-icon.png" },
      { source: "/icon", destination: "/icon.png" },
    ];
  },
};

export default nextConfig;
