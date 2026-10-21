import type { Metadata } from 'next'
import { Barlow_Condensed, Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryProvider } from '@/providers/query-provider'
import { Toaster } from '@/components/ui/toaster'
import { THEME_INIT_SCRIPT } from '@/lib/theme'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' })
const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BirdieAtlas',
  description: 'Sistema de gestão de federações de badminton',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o script de tema altera class/style de <html> antes da hidratação.
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <head>
        {/* Script síncrono: define a classe `dark` antes da primeira pintura (sem flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning prevents false-positive mismatch caused by
          browser extensions that inject attributes into <body> before React hydrates
          (e.g. ColorZilla injects cz-shortcut-listen="true") */}
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <QueryProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
