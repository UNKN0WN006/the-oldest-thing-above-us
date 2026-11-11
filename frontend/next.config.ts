import type { NextConfig } from "next";

const backend = process.env.ABOVEUS_API_URL ?? "http://127.0.0.1:8000";

const config: NextConfig = {
  reactStrictMode: true,
  // The e2e suite builds into its own directory so it never disturbs a running dev/prod build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async rewrites() {
    // The browser only ever talks to this origin; the API is proxied.
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default config;
