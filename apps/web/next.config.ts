import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O E2E (apps/e2e) builda em outra pasta para não pisar no `.next` do desenvolvimento.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  async headers() {
    return [
      // O service worker nunca fica em cache: uma versão nova precisa chegar na hora.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
