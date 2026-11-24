import { DISCIPLINE_PILL, disciplineShort } from '@/lib/discipline'
import { disciplineLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'

/** Chip de disciplina (docs/DESIGN.md, Chips): sigla visível, nome completo para leitor de tela. */
export function DisciplineChip({ discipline, className }: { discipline: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-5.5 shrink-0 items-center rounded-sm px-1.5 text-xs font-bold', DISCIPLINE_PILL[discipline] ?? 'bg-muted text-muted-foreground', className)}>
      <span aria-hidden="true">{disciplineShort(discipline)}</span>
      <span className="sr-only">{disciplineLabel(discipline)}</span>
    </span>
  )
}
