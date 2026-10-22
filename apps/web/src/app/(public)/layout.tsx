import Link from 'next/link'
import { PublicNavLinks } from '@/components/shared/public-nav'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { MAIN_CONTENT_ID, SkipLink } from '@/components/shared/skip-link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      <header className="border-b border-border bg-card print:hidden">
        <div className="max-w-6xl mx-auto px-4 min-h-14 py-1 flex flex-wrap items-center gap-x-6 gap-y-1">
          <Link href="/" className="font-bold text-lg tracking-tight"><span aria-hidden="true">🏸 </span>BirdieAtlas</Link>
          <nav aria-label="Navegação principal" className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <PublicNavLinks />
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="focus:outline-none max-w-6xl mx-auto px-4 py-8 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  )
}
