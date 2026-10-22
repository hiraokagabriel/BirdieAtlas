import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Cabeçalho de coluna ordenável: `<th scope="col" aria-sort>` com um botão dentro. O estado da ordenação
 * vai em `aria-sort` (não só no ícone), e o botão lê "Ordenar por <coluna>" (WCAG 1.3.1, 4.1.2).
 */
export function SortHeader({
  label,
  active,
  direction,
  onSort,
  className,
}: {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onSort: () => void
  className?: string
}) {
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ChevronUp : ChevronDown
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-4 py-3 text-left', className)}
    >
      <button
        type="button"
        onClick={onSort}
        className="flex min-h-6 items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {label}
        <span className="sr-only">: ordenar</span>
        <Icon className={cn('ml-1 size-3', !active && 'opacity-60')} aria-hidden="true" />
      </button>
    </th>
  )
}
