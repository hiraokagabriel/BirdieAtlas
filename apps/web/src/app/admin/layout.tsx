'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { BrandMark } from '@/components/shared/brand-mark'
import { AdminModeToggle } from '@/components/dashboard/admin-mode-toggle'
import { ATTENTION_QUERY } from '@/lib/attention'
import { ADMIN_NAV, isNavItemActive } from '@/lib/navigation'
import { MAIN_CONTENT_ID, SkipLink } from '@/components/shared/skip-link'

/** Item do menu lateral: ativo em névoa de quadra (docs/DESIGN.md, Navigation > Admin). */
const SIDE_ITEM = 'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors'
const SIDE_IDLE = 'text-muted-foreground hover:bg-muted hover:text-foreground'
const SIDE_ACTIVE = 'bg-secondary text-secondary-foreground [&>svg]:text-primary'

/** Contador amarelo do "Ao vivo": partidas ao vivo agora (o único lugar do menu com cor de estado vivo). */
function LiveCount({ count, collapsed = false }: { count: number; collapsed?: boolean }) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-live px-1 text-xs font-bold tabular-nums text-live-foreground',
        // Recolhido (md): no canto do item, sem cobrir o ícone.
        collapsed ? 'absolute -right-1.5 -top-1.5 lg:static lg:ml-auto' : 'ml-auto',
      )}
    >
      {count}
      <span className="sr-only"> {count === 1 ? 'partida ao vivo' : 'partidas ao vivo'}</span>
    </span>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const liveMatches = useQuery(ATTENTION_QUERY).data?.liveMatches ?? 0
  const current = ADMIN_NAV.find(({ href }) => isNavItemActive(pathname, href, '/admin'))

  return (
    <div data-density="compact" className="flex h-screen overflow-hidden bg-background">
      <SkipLink />
      {/* Menu lateral de 232 px; no tablet (md) recolhe para ícones, com o nome ainda lido pelo leitor de tela. */}
      <aside className="hidden w-16 shrink-0 flex-col border-r border-border bg-sidebar md:flex lg:w-58">
        <Link href="/admin" className="flex h-14 items-center gap-2 border-b border-border px-5 font-heading text-xl font-bold leading-none">
          <BrandMark />
          <span className="sr-only lg:not-sr-only">
            Birdie<span className="text-primary">Atlas</span>
          </span>
        </Link>

        <nav aria-label="Navegação administrativa" className="flex-1 space-y-0.5 px-3 py-3">
          {ADMIN_NAV.map(({ label, href, icon: Icon }) => {
            const active = isNavItemActive(pathname, href, '/admin')
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-current={active ? 'page' : undefined}
                className={cn(SIDE_ITEM, 'relative justify-center lg:justify-start', active ? SIDE_ACTIVE : SIDE_IDLE)}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only lg:not-sr-only">{label}</span>
                {href === '/admin/live' && <LiveCount count={liveMatches} collapsed />}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border px-3 py-3">
          <Link href="/" title="Portal público" className={cn(SIDE_ITEM, SIDE_IDLE, 'justify-center lg:justify-start')}>
            <ExternalLink className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only lg:not-sr-only">Portal público</span>
          </Link>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 md:px-6">
          <h1 className="truncate font-heading text-xl font-bold">{current?.label ?? 'Administração'}</h1>
          <div className="flex items-center gap-2">
            <AdminModeToggle />
            <ThemeToggle />
          </div>
        </header>

        {/* Celular: a sidebar some e a mesma navegação vira uma faixa rolável. */}
        {/* `relative`: o texto sr-only (absoluto) do contador fica preso à faixa rolável; sem ele, estica a página no celular. */}
        <nav aria-label="Navegação administrativa" className="relative flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {ADMIN_NAV.map(({ label, href, icon: Icon }) => {
            const active = isNavItemActive(pathname, href, '/admin')
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(SIDE_ITEM, 'shrink-0 gap-2', active ? SIDE_ACTIVE : SIDE_IDLE)}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                {label}
                {href === '/admin/live' && <LiveCount count={liveMatches} />}
              </Link>
            )
          })}
        </nav>

        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 overflow-auto focus:outline-none">
          <div className="mx-auto max-w-350 p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
