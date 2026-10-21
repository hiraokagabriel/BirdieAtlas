import Link from 'next/link'
import { PUBLIC_NAV } from '@/lib/navigation'
import { ThemeToggle } from '@/components/shared/theme-toggle'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/" className="font-bold text-lg tracking-tight">🏸 BirdieAtlas</Link>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            {PUBLIC_NAV.map(({ label, href }) => (
              <Link key={href} href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                {label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
