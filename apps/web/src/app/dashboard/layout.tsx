import Link from 'next/link'
import { ReactNode } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Visao Geral' },
  { href: '/dashboard/athletes', label: 'Atletas' },
  { href: '/dashboard/clubs', label: 'Clubes' },
  { href: '/dashboard/tournaments', label: 'Torneios' },
  { href: '/dashboard/rankings', label: 'Rankings' },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 h-full w-64 border-r bg-card p-6">
        <div className="mb-8">
          <h1 className="text-xl font-bold">BirdieAtlas</h1>
          <p className="text-sm text-muted-foreground">Admin Dashboard</p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  )
}
