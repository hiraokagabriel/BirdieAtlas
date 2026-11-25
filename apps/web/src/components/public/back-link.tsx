import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

/** "‹ Nível pai" acima do título (docs/DESIGN.md, Navigation > Voltar). O pai sempre tem nome. */
export function BackLink({ href = '/', children = 'Início' }: { href?: string; children?: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex h-11 max-w-full items-center gap-1 rounded-md px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </Link>
  )
}
