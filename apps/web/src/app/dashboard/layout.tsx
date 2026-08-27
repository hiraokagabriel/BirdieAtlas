import type { ReactNode } from 'react'
import Link from 'next/link'

const navItems = [
  { href: '/dashboard', label: 'Visão Geral' },
  { href: '/dashboard/athletes', label: 'Atletas' },
  { href: '/dashboard/clubs', label: 'Clubes' },
  { href: '/dashboard/tournaments', label: 'Torneios' },
  { href: '/dashboard/rankings', label: 'Rankings' },
]

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="w-full shrink-0 border-b bg-card md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-xl font-bold">BirdieAtlas</h1>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>

          <nav className="space-y-2" aria-label="Navegação principal">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
