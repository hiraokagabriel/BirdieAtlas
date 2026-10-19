import Link from 'next/link'
import type { Pagination } from '@birdie-atlas/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Paginação por links `?page=N` para Server Components. Some quando há uma página só. */
export function PagerLinks({ pagination, basePath }: { pagination: Pagination; basePath: string }) {
  const { page, totalPages, total } = pagination
  if (totalPages <= 1) return null

  const linkCls = 'inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-sm hover:bg-muted transition-colors'
  const disabledCls = `${linkCls} opacity-40 pointer-events-none`

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>
        Página {page} de {totalPages} · {total} registro{total !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={linkCls} href={`${basePath}?page=${page - 1}`}>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            Anterior
          </Link>
        ) : (
          <span className={disabledCls} aria-disabled="true">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link className={linkCls} href={`${basePath}?page=${page + 1}`}>
            Próxima
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className={disabledCls} aria-disabled="true">
            Próxima
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  )
}
