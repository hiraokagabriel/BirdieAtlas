import Link from 'next/link'
import { BrandMark } from '@/components/shared/brand-mark'
import { PublicNavLinks, PublicTabBar } from '@/components/shared/public-nav'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { MAIN_CONTENT_ID, SkipLink } from '@/components/shared/skip-link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-border bg-background print:hidden">
        <div className="mx-auto flex h-15 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="inline-flex items-center gap-2 font-heading text-[1.375rem] font-bold leading-none">
            <BrandMark />
            <span>
              Birdie<span className="text-primary">Atlas</span>
            </span>
          </Link>
          <nav aria-label="Navegação principal" className="ml-auto flex items-center gap-1">
            <div className="hidden items-center gap-1 md:flex">
              <PublicNavLinks />
            </div>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-6 pb-24 focus:outline-none md:pt-8 md:pb-12 print:max-w-none print:p-0">
        {children}
      </main>
      <PublicTabBar />
    </div>
  )
}
