import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Tab pages are fully prefetched (data included) and kept for 5 min, so tapping a tab renders from memory.
  experimental: {
    staleTimes: { static: 300, dynamic: 0 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
