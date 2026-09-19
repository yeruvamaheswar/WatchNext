import type { NextConfig } from "next";

const extraOrigins = (process.env.ALLOWED_DEV_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // 127.0.0.1 vs localhost is treated as cross-origin in Next 16; LAN IPs go here too.
  allowedDevOrigins: ["127.0.0.1", "localhost", "0.0.0.0", ...extraOrigins],
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
};

export default nextConfig;
