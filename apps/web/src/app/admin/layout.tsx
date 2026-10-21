'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Feather, ChevronRight, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { AdminModeToggle } from '@/components/dashboard/admin-mode-toggle'
import { ADMIN_NAV, isNavItemActive } from '@/lib/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const current = ADMIN_NAV.find(({ href }) => isNavItemActive(pathname, href, '/admin'))

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 flex flex-col border-r border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
            <Feather className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">BirdieAtlas</p>
            <p className="text-xs text-muted-foreground mt-0.5">Administração</p>
          </div>
        </div>

        <Separator />

        <nav className="flex-1 px-3 py-4 space-y-1">
          {ADMIN_NAV.map(({ label, href, icon: Icon }) => {
            const active = isNavItemActive(pathname, href, '/admin')
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            )
          })}
        </nav>

        <Separator />

        <div className="px-3 py-4">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            Ver site público
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 px-8 py-4 border-b border-border shrink-0">
          <h1 className="text-xl font-semibold">{current?.label ?? 'Administração'}</h1>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>

      <AdminModeToggle />
    </div>
  )
}
