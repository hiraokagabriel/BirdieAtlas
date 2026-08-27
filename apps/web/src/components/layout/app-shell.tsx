"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { USER_MODE_METADATA, type UserMode, useUserMode } from "@/contexts/user-mode";
import { UserSwitcher } from "@/components/layout/user-switcher";

interface NavigationItem {
  href: string;
  label: string;
  icon: string;
}

const NAVIGATION: Record<UserMode, NavigationItem[]> = {
  public: [
    { href: "/", label: "Início", icon: "⌂" },
    { href: "/dashboard", label: "Visão geral", icon: "◫" },
    { href: "/tournaments", label: "Torneios", icon: "♜" },
    { href: "/rankings", label: "Rankings", icon: "≋" },
  ],
  athlete: [
    { href: "/dashboard", label: "Dashboard", icon: "◫" },
    { href: "/profile", label: "Meu perfil", icon: "◉" },
    { href: "/registrations", label: "Minhas inscrições", icon: "□" },
    { href: "/my-matches", label: "Minhas partidas", icon: "◇" },
  ],
  judge: [
    { href: "/dashboard", label: "Dashboard", icon: "◫" },
    { href: "/matches", label: "Partidas", icon: "◇" },
    { href: "/courts", label: "Quadras", icon: "▦" },
    { href: "/history", label: "Histórico", icon: "◷" },
  ],
  admin: [
    { href: "/dashboard", label: "Dashboard", icon: "◫" },
    { href: "/athletes", label: "Atletas", icon: "◇" },
    { href: "/clubs", label: "Clubes", icon: "▣" },
    { href: "/tournaments", label: "Torneios", icon: "♜" },
    { href: "/rankings", label: "Rankings", icon: "≋" },
  ],
  "super-admin": [
    { href: "/dashboard", label: "Dashboard", icon: "◫" },
    { href: "/tenants", label: "Organizações", icon: "▣" },
    { href: "/users", label: "Usuários", icon: "◉" },
    { href: "/stats", label: "Indicadores", icon: "≋" },
    { href: "/logs", label: "Logs", icon: "□" },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const { mode, hydrated } = useUserMode();
  const pathname = usePathname();
  const currentMode = hydrated ? mode : "public";
  const metadata = USER_MODE_METADATA[currentMode];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:grid md:grid-cols-[248px_1fr]">
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 md:h-20">
          <Link href="/" className="text-xl font-bold tracking-tight text-teal-800">
            BirdieAtlas
          </Link>
          <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800 md:hidden">
            {metadata.label}
          </span>
        </div>
        <div className="hidden px-4 py-5 md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Ambiente de teste</p>
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">{metadata.icon} {metadata.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{metadata.description}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:block md:space-y-1 md:px-4">
          {NAVIGATION[currentMode].map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-teal-700 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:h-20 md:px-8">
          <div>
            <p className="text-sm font-semibold text-slate-800">BirdieAtlas</p>
            <p className="text-xs text-slate-500">Protótipo de experiência</p>
          </div>
          <UserSwitcher />
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
