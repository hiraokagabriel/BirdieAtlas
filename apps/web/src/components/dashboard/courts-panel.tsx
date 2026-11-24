'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { tvCourtSlots, type LiveMatch, type QueueMatch, type TvCourtSlot } from '@/lib/live'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FIELD_CONTROL_CLASS } from '@/components/ui/field'
import { RefreshCw } from 'lucide-react'
import { DisciplineChip } from '@/components/public/discipline-chip'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'
import { rememberCourt } from '@/components/live/court-console'
import { PanelHeader } from './panel-header'

type TournamentOption = { id: string; name: string; status: string }

/** Sets encerrados e o corrente, este em verde (docs/DESIGN.md, Linha de partida). */
function Score({ match: m }: { match: LiveMatch }) {
  const closed = m.sets.map((s) => `${s.score1}–${s.score2}`)
  const current = m.currentSet ? `${m.currentSet.score1}–${m.currentSet.score2}` : closed.length ? null : '0–0'
  return (
    <p className="flex flex-wrap gap-x-2 font-heading text-xl font-bold tabular-nums">
      {closed.map((s, i) => <span key={i}>{s}</span>)}
      {current && <span className="text-primary">{current}</span>}
    </p>
  )
}

/** Colunas conforme o número de quadras: uma ou duas quadras não deixam metade da grade vazia. */
function gridColumns(count: number): string {
  if (count <= 1) return ''
  if (count === 2) return 'sm:grid-cols-2'
  return 'sm:grid-cols-2 xl:grid-cols-3'
}

function CourtCell({ slot, tournamentId }: { slot: TvCourtSlot; tournamentId: string }) {
  const { court, live, next } = slot
  const title = court === null ? 'Sem quadra' : `Quadra ${court}`
  const leader = live ? (live.setsWon.side1 === live.setsWon.side2 ? 0 : live.setsWon.side1 > live.setsWon.side2 ? 1 : 2) : 0
  return (
    <li className={cn('grid min-h-28 content-start gap-1.5 border-b border-r border-border px-4 py-3', live ? 'bg-card' : 'bg-muted/50')}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-base font-bold uppercase tracking-wide">{title}</span>
        {live ? (
          <span className="flex items-center gap-1.5">
            <DisciplineChip discipline={live.discipline} />
            <Badge variant="live">Ao vivo</Badge>
          </span>
        ) : (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">Livre</Badge>
        )}
      </div>
      {live ? (
        <>
          <p className="text-sm leading-snug">
            <span className={cn('block break-words', leader === 1 && 'font-semibold')}>{live.participant1 ?? 'A definir'}</span>
            <span className={cn('block break-words', leader === 2 && 'font-semibold')}>{live.participant2 ?? 'A definir'}</span>
          </p>
          <Score match={live} />
        </>
      ) : next ? (
        <>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Próxima · {next.categoryName}</p>
            <p className="text-sm leading-snug">
              <span className="block break-words">{next.participant1}</span>
              <span className="block break-words">x {next.participant2}</span>
            </p>
          </div>
          <Button asChild variant="outline" className="justify-self-start">
            <Link href="/admin/live" onClick={() => rememberCourt(tournamentId, court)}>
              Chamar partida<span className="sr-only"> na {title.toLowerCase()}</span>
            </Link>
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Sem partida na fila.</p>
      )}
    </li>
  )
}

/** Quadras do torneio em andamento: quem joga em cada uma e a próxima da fila nas livres (template admin). */
export function CourtsPanel() {
  const [picked, setPicked] = useState<string | null>(null)
  const tournaments = useQuery({
    queryKey: ['live-tournaments'],
    queryFn: () => apiFetch<Paginated<TournamentOption>>('/tournaments?status=in_progress&pageSize=100'),
  })
  const options = tournaments.data?.data ?? []
  const tournamentId = options.find((t) => t.id === picked)?.id ?? options[0]?.id ?? null

  // Mesmas chaves do console do operador: o cache é compartilhado entre as duas telas.
  const live = useQuery({
    queryKey: ['live', tournamentId],
    queryFn: () => apiFetch<LiveMatch[]>(`/tournaments/${tournamentId}/live/matches`),
    enabled: tournamentId !== null,
    refetchInterval: 10_000,
  })
  const queue = useQuery({
    queryKey: ['live-queue', tournamentId],
    queryFn: () => apiFetch<QueueMatch[]>(`/tournaments/${tournamentId}/live/queue`),
    enabled: tournamentId !== null,
    refetchInterval: 15_000,
  })

  const loading = tournaments.isPending || (tournamentId !== null && (live.isPending || queue.isPending))
  // Falha num polling com dado em cache não derruba o painel (TanStack Query mantém `data`).
  const failure = [tournaments, live, queue].find((q) => q.isError && !q.data)
  const slots = live.data && queue.data ? tvCourtSlots(live.data, queue.data) : []

  return (
    <section aria-labelledby="courts-title" className="relative overflow-hidden rounded-lg border border-border bg-card">
      <PanelHeader id="courts-title" title="Quadras">
        {options.length > 1 ? (
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor="courts-tournament" className="text-xs text-muted-foreground">Torneio</label>
            <select
              id="courts-tournament"
              value={tournamentId ?? ''}
              onChange={(e) => setPicked(e.target.value)}
              className={cn(FIELD_CONTROL_CLASS, 'min-w-0 max-w-56')}
            >
              {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        ) : options[0] ? (
          <span className="text-xs text-muted-foreground">{options[0].name}</span>
        ) : null}
      </PanelHeader>
      {failure ? (
        <div className="space-y-3 p-4">
          <ErrorNotice>
            Não foi possível carregar as quadras: {failure.error instanceof Error ? failure.error.message : 'erro inesperado'}.
          </ErrorNotice>
          <Button variant="outline" onClick={() => void failure.refetch()}>
            <RefreshCw aria-hidden="true" /> Tentar de novo
          </Button>
        </div>
      ) : loading ? (
        <div role="status" aria-busy="true" className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <span className="sr-only">Carregando quadras…</span>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-22 w-full" />)}
        </div>
      ) : tournamentId === null ? (
        <div className="p-4">
          <EmptyNotice>Nenhum torneio em andamento. As quadras aparecem aqui quando um torneio começar.</EmptyNotice>
        </div>
      ) : slots.length === 0 ? (
        <div className="p-4">
          <EmptyNotice>Nenhuma partida com quadra definida. Gere a agenda do torneio para distribuir as partidas nas quadras.</EmptyNotice>
        </div>
      ) : (
        // Bordas por célula (direita e embaixo) e a margem negativa esconde as da última coluna e linha:
        // sem fundo de grade, uma quadra sozinha não deixa área cinza ao lado.
        <ul className={cn('-mb-px -mr-px grid', gridColumns(slots.length))}>
          {slots.map((slot) => (
            <CourtCell key={slot.live?.matchId ?? `court-${slot.court}`} slot={slot} tournamentId={tournamentId} />
          ))}
        </ul>
      )}
    </section>
  )
}
