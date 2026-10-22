'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PUBLIC_NAV, isNavItemActive } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/** Itens de `PUBLIC_NAV` com `aria-current="page"` na página atual (WCAG 1.3.1, 2.4.8). */
export function PublicNavLinks() {
  const pathname = usePathname()
  return (
    <>
      {PUBLIC_NAV.map(({ label, href }) => {
        const active = isNavItemActive(pathname, href, '/')
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-6 items-center transition-colors hover:text-foreground',
              active ? 'font-semibold text-foreground underline underline-offset-4' : 'text-muted-foreground',
            )}
          >
            {label}
          </Link>
        )
      })}
    </>
  )
}
