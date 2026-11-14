import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O E2E (apps/e2e) builda em outra pasta para não pisar no `.next` do desenvolvimento.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  // Em `next dev`, o Next bloqueia scripts pedidos de outra origem: sem isto, o celular que abre pelo IP da rede
  // carrega a página sem JavaScript. Lista separada por vírgula, ex.: 192.168.15.4. Não afeta `next start`.
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean),

  async headers() {
    return [
      // Cabeçalhos de segurança em todas as rotas (o HSTS só vale quando servido por HTTPS).
      // Sem CSP completa por enquanto: o Next injeta scripts inline; frame-ancestors impede embutir o site.
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
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
