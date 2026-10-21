import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O E2E (apps/e2e) builda em outra pasta para não pisar no `.next` do desenvolvimento.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
