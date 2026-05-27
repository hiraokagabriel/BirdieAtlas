'use client'

import { use, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { Trophy, ChevronLeft, ChevronRight, Users, User } from 'lucide-react'

type Ranking = {
  id: string
  name: string
  discipline: 'MS' | 'WS' | 'MD' | 'WD' | 'XD'
  year: number
  tenantId: string
}

type AthleteData = { id: string; name: string; gender: string }

type Entry = {
  id: string
  position: number
  points: number
  athleteId: string
  athlete2Id: string | null
  athlete: AthleteData | null
  athlete2: AthleteData | null
}

type RankingResponse = {
  ranking: Ranking
  entries: Entry[]
  pagination: { page: number; perPage: number; total: number; totalPages: number }
}

const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.',
  WS: 'Simples Fem.',
  MD: 'Duplas Masc.',
  WD: 'Duplas Fem.',
  XD: 'Duplas Misto',
}

const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-500/10 text-blue-700 border-blue-200',
  WS: 'bg-purple-500/10 text-purple-700 border-purple-200',
  MD: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
  WD: 'bg-pink-500/10 text-pink-700 border-pink-200',
  XD: 'bg-orange-500/10 text-orange-700 border-orange-200',
}

const disciplineActiveColors: Record<string, string> = {
  MS: 'bg-blue-500 text-white border-blue-500',
  WS: 'bg-purple-500 text-white border-purple-500',
  MD: 'bg-cyan-500 text-white border-cyan-500',
  WD: 'bg-pink-500 text-white border-pink-500',
  XD: 'bg-orange-500 text-white border-orange-500',
}

function PositionBadge({ pos }: { pos: number }) {
  if (pos === 1) return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-yellow-900 font-bold text-sm">🥇</span>
  if (pos === 2) return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-gray-800 font-bold text-sm">🥈</span>
  if (pos === 3) return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-600/80 text-white font-bold text-sm">🥉</span>
  return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-semibold text-sm">{pos}</span>
}

export default function RankingPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params)

  const [rankings, setRankings] = useState<Ranking[]>([])
  const [activeRankingId, setActiveRankingId] = useState('')
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const PER_PAGE = 25

  useEffect(() => {
    apiFetch<Ranking[]>(`/rankings?tenantSlug=${tenantSlug}`).then((list) => {
      setRankings(list)
      if (list.length) setActiveRankingId(list[0].id)
    })
  }, [tenantSlug])

  useEffect(() => {
    if (!activeRankingId) return
    setLoading(true)
    setPage(1)
    apiFetch<RankingResponse>(`/rankings/${activeRankingId}/entries?page=1&perPage=${PER_PAGE}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [activeRankingId])

  useEffect(() => {
    if (!activeRankingId || page === 1) return
    setLoading(true)
    apiFetch<RankingResponse>(`/rankings/${activeRankingId}/entries?page=${page}&perPage=${PER_PAGE}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [page])

  const activeRanking = rankings.find((r) => r.id === activeRankingId)
  const isDoubles = activeRanking ? ['MD', 'WD', 'XD'].includes(activeRanking.discipline) : false
  const pagination = data?.pagination

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-2">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h1 className="text-2xl font-bold tracking-tight">Ranking</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Classificação oficial dos atletas filiados à federação
        </p>
      </div>

      {/* Seletor de ranking */}
      <div className="flex items-center gap-2 flex-wrap">
        {rankings.map((r) => {
          const isActive = r.id === activeRankingId
          const color = isActive ? disciplineActiveColors[r.discipline] : disciplineColors[r.discipline]
          return (
            <button
              key={r.id}
              onClick={() => setActiveRankingId(r.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${color ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
            >
              {disciplineLabel[r.discipline] ?? r.discipline}
            </button>
          )
        })}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header da tabela */}
        <div className="grid grid-cols-[3rem_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>#</span>
          <span>{isDoubles ? 'Dupla' : 'Atleta'}</span>
          <span className="text-right">Pontos</span>
        </div>

        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: PER_PAGE }).map((_, i) => (
              <div key={i} className="grid grid-cols-[3rem_1fr_auto] gap-4 px-5 py-3.5 border-b border-border/50 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-40 bg-muted rounded" />
                  {isDoubles && <div className="h-3 w-32 bg-muted rounded" />}
                </div>
                <div className="h-4 w-16 bg-muted rounded self-center" />
              </div>
            ))}
          </div>
        ) : !data?.entries.length ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="font-medium">Nenhuma entrada encontrada</p>
          </div>
        ) : (
          <div>
            {data.entries.map((entry, idx) => {
              const globalPos = ((page - 1) * PER_PAGE) + idx + 1
              const isTop3 = entry.position <= 3
              return (
                <div
                  key={entry.id}
                  className={`grid grid-cols-[3rem_1fr_auto] gap-4 px-5 py-3.5 border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30 ${
                    isTop3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <PositionBadge pos={entry.position} />
                  </div>

                  <div className="flex flex-col justify-center min-w-0">
                    {isDoubles ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {entry.athlete?.name ?? '—'} &amp; {entry.athlete2?.name ?? '—'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{entry.athlete?.name ?? '—'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    <span className={`font-semibold tabular-nums ${
                      isTop3 ? 'text-yellow-700 dark:text-yellow-400 text-base' : 'text-sm text-foreground'
                    }`}>
                      {entry.points.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Paginação */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, pagination.total)} de {pagination.total} atletas
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium px-3">{page} / {pagination.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
