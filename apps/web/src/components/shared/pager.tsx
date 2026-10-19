'use client'

import type { Pagination } from '@birdie-atlas/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Navegação entre páginas de uma lista `{ data, pagination }`. Some quando há uma página só. */
export function Pager({ pagination, onPageChange }: { pagination: Pagination; onPageChange: (page: number) => void }) {
  const { page, totalPages, total } = pagination
  if (totalPages <= 1) return null

  const buttonCls =
    'inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none'

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>
        Página {page} de {totalPages} · {total} registro{total !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonCls} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          Anterior
        </button>
        <button type="button" className={buttonCls} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Próxima
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
