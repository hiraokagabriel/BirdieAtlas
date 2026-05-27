'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { ScheduleDialog } from './schedule-dialog'
import { CalendarClock, Pencil } from 'lucide-react'

const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-100 text-blue-700',
  WS: 'bg-purple-100 text-purple-700',
  MD: 'bg-cyan-100 text-cyan-700',
  WD: 'bg-pink-100 text-pink-700',
  XD: 'bg-orange-100 text-orange-700',
}

const statusLabel: Record<string, { label: string; dot: string }> = {
  pending: { label: 'Aguardando', dot: 'bg-gray-300' },
  in_progress: { label: 'Ao vivo', dot: 'bg-green-500 animate-pulse' },
  completed: { label: 'Encerrada', dot: 'bg-blue-400' },
  walkover: { label: 'W.O.', dot: 'bg-yellow-400' },
  retired: { label: 'Ret.', dot: 'bg-red-400' },
}

type Category = { id: string; name: string; discipline: string }
type Match = {
  id: string; drawId: string; round: number; position: number; status: string
  registration1Id: string | null; registration2Id: string | null
  scheduledAt: string | null; courtNumber: number | null; nextMatchId: string | null
}
type Registration = { id: string; athleteId: string; athlete2Id: string | null; seed: number | null }
type Athlete = { id: string; name: string }

type Props = {
  tournamentId: string
  categories: Category[]
  readonly?: boolean
}

function getAthleteLabel(regId: string | null, regs: Registration[], athletes: Athlete[]): string {
  if (!regId) return 'A definir'
  const reg = regs.find((r) => r.id === regId)
  if (!reg) return '?'
  const a1 = athletes.find((a) => a.id === reg.athleteId)
  const a2 = reg.athlete2Id ? athletes.find((a) => a.id === reg.athlete2Id) : null
  return a2 ? `${a1?.name ?? '?'} / ${a2.name}` : (a1?.name ?? '?')
}

function getRoundLabel(round: number): string {
  return round === 1 ? 'Final' : round === 2 ? 'Semifinal' : round === 3 ? 'Quartas' : `Fase ${round}`
}

export function ScheduleView({ tournamentId, categories, readonly = false }: Props) {
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedMatch, setSelectedMatch] = useState<(Match & { drawId: string; categoryId: string }) | null>(null)
  const [selectedP1, setSelectedP1] = useState('')
  const [selectedP2, setSelectedP2] = useState('')

  // Busca todos os draws e partidas de todas as categorias
  const { data: allData } = useQuery({
    queryKey: ['schedule-all', tournamentId],
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

  const { data: athletes } = useQuery({
    queryKey: ['athletes'],
    queryFn: () => apiFetch<Athlete[]>('/athletes'),
  })

  // Flatten e ordena por horário agendado (sem horário fica no fim)
  const flatMatches = (allData ?? []).flatMap(({ category, matches, registrations }) =>
    matches.map((m) => ({ ...m, category, registrations }))
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

  // Agrupa por data
  const grouped: Record<string, typeof filtered> = {}
  for (const m of filtered) {
    const key = m.scheduledAt
      ? new Date(m.scheduledAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      : 'Sem horário definido'
    grouped[key] = [...(grouped[key] ?? []), m]
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background"
        >
          <option value="all">Todos os status</option>
          <option value="pending">Aguardando</option>
          <option value="in_progress">Ao vivo</option>
          <option value="completed">Encerradas</option>
        </select>
      </div>

      {/* Lista agrupada por data */}
      {Object.entries(grouped).length === 0 ? (
        <div className="rounded-xl border border-border p-12 text-center text-muted-foreground">
          <CalendarClock className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma partida encontrada</p>
        </div>
      ) : (
        Object.entries(grouped).map(([dateLabel, dayMatches]) => (
          <div key={dateLabel} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 capitalize">
              {dateLabel}
            </h3>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {dayMatches.map((match) => {
                const p1 = getAthleteLabel(match.registration1Id, match.registrations, athletes ?? [])
                const p2 = getAthleteLabel(match.registration2Id, match.registrations, athletes ?? [])
                const status = statusLabel[match.status] ?? statusLabel.pending
                const disciplineColor = disciplineColors[match.category.discipline] ?? 'bg-gray-100 text-gray-700'

                return (
                  <div key={match.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    {/* Hora + quadra */}
                    <div className="w-24 shrink-0 text-center">
                      {match.scheduledAt ? (
                        <>
                          <p className="text-sm font-semibold font-mono">
                            {new Date(match.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {match.courtNumber && (
                            <p className="text-xs text-muted-foreground">Quadra {match.courtNumber}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* Categoria + round */}
                    <div className="w-28 shrink-0 space-y-1">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${disciplineColor}`}>
                        {match.category.name}
                      </span>
                      <p className="text-xs text-muted-foreground">{getRoundLabel(match.round)}</p>
                    </div>

                    {/* Atletas */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p1}</p>
                      <p className="text-xs text-muted-foreground">vs</p>
                      <p className="text-sm font-medium truncate">{p2}</p>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      <span className="text-xs text-muted-foreground hidden sm:block">{status.label}</span>
                    </div>

                    {/* Botão agendar (só admin) */}
                    {!readonly && (
                      <button
                        onClick={() => {
                          setSelectedMatch({ ...match })
                          setSelectedP1(p1)
                          setSelectedP2(p2)
                        }}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
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
