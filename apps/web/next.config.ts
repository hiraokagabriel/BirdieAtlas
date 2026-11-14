import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O E2E (apps/e2e) builda em outra pasta para não pisar no `.next` do desenvolvimento.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  // Em `next dev`, o Next bloqueia scripts pedidos de outra origem: sem isto, o celular que abre pelo IP da rede
  // carrega a página sem JavaScript. Lista separada por vírgula, ex.: 192.168.15.4. Não afeta `next start`.
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean),

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
