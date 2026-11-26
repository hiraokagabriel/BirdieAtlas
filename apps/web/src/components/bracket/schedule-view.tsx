'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { ScheduleDialog } from './schedule-dialog'
import { AutoScheduleDialog } from './auto-schedule-dialog'
import { Button } from '@/components/ui/button'
import { Pencil, Wand2 } from 'lucide-react'
import { CalendarClock } from '@/components/icons/ba'
import { DISCIPLINE_PILL, disciplineShort } from '@/lib/discipline'
import { cn } from '@/lib/utils'

const statusLabel: Record<string, { label: string; dot: string }> = {
  pending: { label: 'Aguardando', dot: 'bg-muted-foreground/40' },
  // Amarelo-peteca só no estado vivo (docs/DESIGN.md, Regra do Agora).
  in_progress: { label: 'Ao vivo', dot: 'bg-live motion-safe:animate-pulse' },
  completed: { label: 'Encerrada', dot: 'bg-info' },
  walkover: { label: 'W.O.', dot: 'bg-muted-foreground' },
  retired: { label: 'Ret.', dot: 'bg-destructive' },
}

type Category = { id: string; name: string; discipline: string }
type Match = {
  id: string; drawId: string; round: number; roundLabel?: string | null; position: number; status: string
  registration1Id: string | null; registration2Id: string | null
  scheduledAt: string | null; courtNumber: number | null; nextMatchId: string | null
}
type Registration = {
  id: string; athleteId: string; athlete2Id: string | null; seed: number | null
  athleteName: string | null; athlete2Name: string | null
}

type Props = {
  tournamentId: string
  categories: Category[]
  readonly?: boolean
  /** "YYYY-MM-DD": dia sugerido para o início da agenda automática. */
  defaultStartDate?: string
  /** Público: link de cada nome (as partidas do jogador no torneio). Sem ele, os nomes são texto. */
  playerHref?: (athleteId: string) => string
}

function getAthleteLabel(regId: string | null, regs: Registration[]): string {
  if (!regId) return 'A definir'
  const reg = regs.find((r) => r.id === regId)
  if (!reg) return '?'
  return reg.athlete2Id ? `${reg.athleteName ?? '?'} / ${reg.athlete2Name ?? '?'}` : (reg.athleteName ?? '?')
}

/** Lado da partida: nomes (com link quando `href` vem) ou "A definir". */
function SideNames({ regId, regs, href }: { regId: string | null; regs: Registration[]; href: ((id: string) => string) | undefined }) {
  const reg = regId ? regs.find((r) => r.id === regId) : undefined
  if (!reg || !href) return <span className="font-medium">{getAthleteLabel(regId, regs)}</span>
  const people = [{ id: reg.athleteId, name: reg.athleteName ?? '?' }, ...(reg.athlete2Id ? [{ id: reg.athlete2Id, name: reg.athlete2Name ?? '?' }] : [])]
  return (
    <span className="font-medium">
      {people.map((p, i) => (
        <span key={p.id}>
          {i > 0 && ' / '}
          <Link href={href(p.id)} className="inline-flex min-h-6 items-center rounded-sm underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-primary focus-visible:outline-offset-2">{p.name}</Link>
        </span>
      ))}
    </span>
  )
}

function getRoundLabel(round: number): string {
  return round === 1 ? 'Final' : round === 2 ? 'Semifinal' : round === 3 ? 'Quartas' : `Fase ${round}`
}

export function ScheduleView({ tournamentId, categories, readonly = false, defaultStartDate, playerHref }: Props) {
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedMatch, setSelectedMatch] = useState<(Match & { drawId: string; categoryId: string }) | null>(null)
  const [selectedP1, setSelectedP1] = useState('')
  const [selectedP2, setSelectedP2] = useState('')
  const [autoOpen, setAutoOpen] = useState(false)

  const { data: allData } = useQuery({
    // As categorias chegam depois do torneio: sem elas na chave, abrir a aba cedo demais deixava a lista vazia para sempre.
    queryKey: ['schedule-all', tournamentId, categories.map((c) => c.id)],
    queryFn: async () => {
      const results: { category: Category; matches: Match[]; registrations: Registration[] }[] = []
      for (const cat of categories) {
        const drawList = await apiFetch<{ id: string }[]>(`/tournaments/categories/${cat.id}/draws`)
        if (!drawList.length) continue
        const draw = drawList[0]
        const [matchList, regList] = await Promise.all([
          apiFetch<Match[]>(`/draws/${draw.id}/matches`),
          apiFetch<Registration[]>(`/tournaments/categories/${cat.id}/registrations`),
        ])
        results.push({ category: cat, matches: matchList.map((m) => ({ ...m, drawId: draw.id })), registrations: regList })
      }
      return results
    },
  })

  // Flatten — inclui categoryId para satisfazer o tipo do selectedMatch
  const flatMatches = (allData ?? []).flatMap(({ category, matches, registrations }) =>
    matches.map((m) => ({ ...m, categoryId: category.id, category, registrations }))
  )

  const filtered = flatMatches
    .filter((m) => filterCategoryId === 'all' || m.category.id === filterCategoryId)
    .filter((m) => filterStatus === 'all' || m.status === filterStatus)
    .sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      if (a.scheduledAt) return -1
      if (b.scheduledAt) return 1
      return 0
    })

  const grouped: Record<string, typeof filtered> = {}
  for (const m of filtered) {
    const key = m.scheduledAt
      ? new Date(m.scheduledAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      : 'Sem horário definido'
    grouped[key] = [...(grouped[key] ?? []), m]
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          aria-label="Filtrar por categoria"
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="h-(--control-h) min-w-0 max-w-full rounded-md border border-field-border bg-background px-3 text-sm"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          aria-label="Filtrar por situação da partida"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-(--control-h) rounded-md border border-field-border bg-background px-3 text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="pending">Aguardando</option>
          <option value="in_progress">Ao vivo</option>
          <option value="completed">Encerradas</option>
        </select>

        {!readonly && (
          <Button variant="outline" className="ml-auto" onClick={() => setAutoOpen(true)}>
            <Wand2 className="w-4 h-4 mr-2" aria-hidden="true" />
            Gerar agenda automática
          </Button>
        )}
      </div>

      {Object.entries(grouped).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          <CalendarClock className="w-8 h-8 mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p className="font-medium">Nenhuma partida encontrada</p>
        </div>
      ) : (
        Object.entries(grouped).map(([dateLabel, dayMatches]) => (
          <div key={dateLabel} className="space-y-2">
            <h3 className="px-1 font-sans text-sm font-semibold text-muted-foreground first-letter:uppercase">
              {dateLabel}
            </h3>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {dayMatches.map((match) => {
                const p1 = getAthleteLabel(match.registration1Id, match.registrations)
                const p2 = getAthleteLabel(match.registration2Id, match.registrations)
                const status = statusLabel[match.status] ?? statusLabel.pending
                const disciplineColor = DISCIPLINE_PILL[match.category.discipline] ?? 'bg-muted text-muted-foreground'

                return (
                  // Linha de partida (docs/DESIGN.md): horário e quadra à esquerda; categoria, fase e status
                  // numa linha; os dois lados embaixo, sem truncar nomes no celular.
                  <div key={match.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/30">
                    <div className="row-span-2">
                      {match.scheduledAt ? (
                        <>
                          <p className="font-heading text-lg font-bold leading-tight tabular-nums">
                            {new Date(match.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {match.courtNumber && (
                            <p className="text-xs text-muted-foreground">Quadra {match.courtNumber}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Sem horário</span>
                        </p>
                      )}
                    </div>

                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span aria-hidden="true" className={cn('inline-flex h-5.5 items-center rounded-sm px-1.5 font-bold', disciplineColor)}>
                        {disciplineShort(match.category.discipline)}
                      </span>
                      <span className="min-w-0 break-words">{match.category.name} · {match.roundLabel ?? getRoundLabel(match.round)}</span>
                    </p>

                    <div className="flex items-center gap-1.5 justify-self-end pt-0.5">
                      <div aria-hidden="true" className={cn('size-1.5 rounded-full', status.dot)} />
                      <span className="text-xs text-muted-foreground">{status.label}</span>
                    </div>

                    <p className={cn('min-w-0 break-words leading-snug', readonly ? 'col-span-2' : undefined)}>
                      <SideNames regId={match.registration1Id} regs={match.registrations} href={playerHref} />
                      {/* Espaço inseparável antes do ×: ele abre a linha seguinte em vez de ficar sozinho no fim. */}
                      <span className="text-muted-foreground">{' × '}</span>
                      <SideNames regId={match.registration2Id} regs={match.registrations} href={playerHref} />
                    </p>

                    {!readonly && (
                      <button
                        type="button"
                        aria-label={`Agendar partida: ${p1} contra ${p2}`}
                        title="Agendar partida"
                        onClick={() => {
                          setSelectedMatch({ ...match })
                          setSelectedP1(p1)
                          setSelectedP2(p2)
                        }}
                        className="inline-flex size-(--control-h) items-center justify-center justify-self-end rounded-md transition-colors hover:bg-muted"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {!readonly && (
        <AutoScheduleDialog
          tournamentId={tournamentId}
          defaultStartDate={defaultStartDate}
          open={autoOpen}
          onClose={() => setAutoOpen(false)}
        />
      )}

      {!readonly && selectedMatch && (
        <ScheduleDialog
          match={selectedMatch}
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          player1Name={selectedP1}
          player2Name={selectedP2}
          drawId={selectedMatch.drawId}
        />
      )}
    </div>
  )
}
