'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PUBLIC_NAV, PUBLIC_TAB_NAV, isNavItemActive } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/** Itens de `PUBLIC_NAV` com `aria-current="page"` na página atual (WCAG 1.3.1, 2.4.8). */
export function PublicNavLinks() {
  const pathname = usePathname()
  return (
    <>
      {PUBLIC_NAV.map(({ label, href }) => {
        const active = isNavItemActive(pathname, href, '/')
        // No celular, Início e Ranking estão na barra inferior; só a Administração fica no topo.
        const mobile = href === '/admin'
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors hover:bg-muted hover:text-foreground',
              mobile ? 'inline-flex' : 'hidden md:inline-flex',
              active ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </Link>
        )
      })}
    </>
  )
}

/** Barra inferior do portal, só no celular (docs/DESIGN.md, Navigation). */
export function PublicTabBar() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Atalhos do portal"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {PUBLIC_TAB_NAV.map(({ label, href, icon: Icon }) => {
        const active = isNavItemActive(pathname, href, '/')
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
