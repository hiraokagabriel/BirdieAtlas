'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { RankingBoard } from '@/lib/public-data'
import { disciplineShort } from '@/lib/discipline'
import { disciplineLabel, isDoublesDiscipline } from '@/lib/labels'
import { formatPoints } from '@/lib/format'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyNotice, ErrorNotice } from './notices'
import { PlacementBadge } from './placement-badge'
import { ROWS } from './rows'

interface RankingTabsProps {
  boards: RankingBoard[]
  /** Mostra o nome da federação na aba quando há mais de uma. */
  showTenant: boolean
}

const NAME_LINK = 'inline-flex min-h-11 items-center rounded-sm hover:underline'

/** Abas dos rankings ativos (`Tabs`, docs/DESIGN.md); o conteúdo de todas já vem do servidor. */
export function RankingTabs({ boards, showTenant }: RankingTabsProps) {
  const [activeId, setActiveId] = useState(boards[0]?.id ?? '')
  if (boards.length === 0) return null

  return (
    <Tabs value={activeId} onValueChange={setActiveId} className="space-y-3">
      {/* Quebra em linhas em vez de rolar: antes da hidratação o Radix deixa todas as abas com tabindex -1, e uma
          região rolável sem nada focável fica inacessível pelo teclado (axe scrollable-region-focusable). */}
      <TabsList aria-label="Rankings" className="flex-wrap overflow-x-visible">
        {boards.map((board) => (
          <TabsTrigger key={board.id} value={board.id} className="px-3 font-semibold">
            {/* Sigla na tela (cabe no celular); o nome acessível começa pelo texto visível (WCAG 2.5.3). */}
            {disciplineShort(board.discipline)} {board.year}
            {showTenant && ` · ${board.tenantSlug.toUpperCase()}`}
            <span className="sr-only">
              {' '}({disciplineLabel(board.discipline)} {board.year}
              {showTenant && `, ${board.tenantName}`})
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {boards.map((board) => {
        const doubles = isDoublesDiscipline(board.discipline)
        return (
          <TabsContent key={board.id} value={board.id} className="mt-0 space-y-0">
            {board.entries === null ? (
              <ErrorNotice>Não foi possível carregar este ranking agora. Tente novamente em instantes.</ErrorNotice>
            ) : board.entries.length === 0 ? (
              <EmptyNotice>Este ranking ainda não tem atletas classificados. Os pontos aparecem depois do primeiro torneio encerrado.</EmptyNotice>
            ) : (
              <ol className={ROWS}>
                {board.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4">
                    <PlacementBadge placement={entry.position} className="size-8 text-sm" />
                    <span className="min-w-0 flex-1 font-medium">
                      <Link href={`/a/${entry.athleteId}`} className={NAME_LINK}>
                        {entry.athleteName}
                      </Link>
                      {doubles && entry.athlete2Id && (
                        <>
                          {' / '}
                          <Link href={`/a/${entry.athlete2Id}`} className={NAME_LINK}>
                            {entry.athlete2Name ?? '—'}
                          </Link>
                        </>
                      )}
                    </span>
                    <span className="shrink-0 font-heading text-lg font-bold tabular-nums">
                      {formatPoints(entry.totalPoints)}
                      <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">pts</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <Link
              href={`/r/${board.tenantSlug}`}
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-primary hover:underline"
            >
              Ver ranking completo{showTenant ? ` · ${board.tenantName}` : ''}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
