'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { RankingBoard } from '@/lib/public-data'
import { disciplineLabel, isDoublesDiscipline } from '@/lib/labels'
import { formatPoints } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmptyNotice, ErrorNotice } from './notices'
import { PlacementBadge } from './placement-badge'

interface RankingTabsProps {
  boards: RankingBoard[]
  /** Mostra o nome da federação na aba quando há mais de uma. */
  showTenant: boolean
}

function tabLabel(board: RankingBoard, showTenant: boolean): string {
  const base = `${disciplineLabel(board.discipline)} ${board.year}`
  return showTenant ? `${base} · ${board.tenantSlug.toUpperCase()}` : base
}

/** Abas dos rankings ativos; o conteúdo de todas já vem do servidor, o estado local só escolhe qual mostrar. */
export function RankingTabs({ boards, showTenant }: RankingTabsProps) {
  const [activeId, setActiveId] = useState(boards[0]?.id ?? '')
  const baseId = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const active = boards.find((b) => b.id === activeId) ?? boards[0]
  if (!active) return null

  function select(id: string) {
    setActiveId(id)
    tabRefs.current[id]?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = boards.length - 1
    const target =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (target === null) return
    event.preventDefault()
    select(boards[target].id)
  }

  const doubles = isDoublesDiscipline(active.discipline)

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Rankings" className="flex gap-2 overflow-x-auto pb-1">
        {boards.map((board, index) => {
          const selected = board.id === active.id
          return (
            <button
              key={board.id}
              ref={(el) => {
                tabRefs.current[board.id] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${board.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(board.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {tabLabel(board, showTenant)}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active.id}`}
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        {active.entries === null ? (
          <div className="p-4">
            <ErrorNotice>Não foi possível carregar este ranking agora.</ErrorNotice>
          </div>
        ) : active.entries.length === 0 ? (
          <div className="p-4">
            <EmptyNotice>Este ranking ainda não tem atletas classificados.</EmptyNotice>
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {active.entries.map((entry) => (
              <li
                key={entry.id}
                className={cn('flex items-center gap-3 px-4 py-2.5', entry.position === 1 && 'bg-medal-gold/10')}
              >
                <PlacementBadge placement={entry.position} className="size-8 text-sm" />
                <span className="min-w-0 flex-1 text-sm font-medium">
                  <Link
                    href={`/a/${entry.athleteId}`}
                    className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {entry.athleteName}
                  </Link>
                  {doubles && entry.athlete2Id && (
                    <>
                      {' & '}
                      <Link
                        href={`/a/${entry.athlete2Id}`}
                        className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {entry.athlete2Name ?? '—'}
                      </Link>
                    </>
                  )}
                </span>
                <span className="font-heading text-lg font-semibold tabular-nums">
                  {formatPoints(entry.totalPoints)}
                  <span className="ml-1 text-xs font-sans font-normal text-muted-foreground">pts</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="border-t border-border bg-muted/40 px-4 py-2.5 text-sm">
          <Link
            href={`/r/${active.tenantSlug}`}
            className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver ranking completo{showTenant ? ` · ${active.tenantName}` : ''}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
