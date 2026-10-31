'use client'

import { useEffect, useState } from 'react'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { Trophy, ChevronLeft, ChevronRight, Users, User } from 'lucide-react'
import Link from 'next/link'
import { DISCIPLINE_PILL, DISCIPLINE_PILL_ACTIVE } from '@/lib/discipline'
import { PrintButton } from '@/components/shared/print-button'
import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { ShareControl } from '@/components/shared/share-control'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { buildShareText, rankingDisplayName, shareImageFilename, shareImagePath, truncateText } from '@/lib/share'

/** Dados vindos do servidor (page.tsx) para o controle de compartilhar. */
export type RankingShare = { title: string; text: string }

type Ranking = {
  id: string; name: string
  discipline: 'MS' | 'WS' | 'MD' | 'WD' | 'XD'
  year: number; tenantId: string
}
type AthleteData = { id: string; name: string; gender: string }
type Entry = {
  id: string; position: number; totalPoints: number
  athleteId: string; athlete2Id: string | null
  athlete: AthleteData | null; athlete2: AthleteData | null
}
type RankingResponse = Paginated<Entry> & { ranking: Ranking }

const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.', WD: 'Duplas Fem.', XD: 'Duplas Misto',
}
function PositionBadge({ pos }: { pos: number }) {
  if (pos === 1) return <span aria-hidden="true" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-medal-gold text-medal-gold-foreground font-bold text-sm">🥇</span>
  if (pos === 2) return <span aria-hidden="true" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-medal-silver text-medal-silver-foreground font-bold text-sm">🥈</span>
  if (pos === 3) return <span aria-hidden="true" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-medal-bronze text-medal-bronze-foreground font-bold text-sm">🥉</span>
  return <span aria-hidden="true" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-semibold text-sm">{pos}</span>
}

export function RankingView({ tenantSlug, share }: { tenantSlug: string; share: RankingShare }) {
  const [rankings, setRankings] = useState<Ranking[]>([])
  const [activeRankingId, setActiveRankingId] = useState('')
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const PER_PAGE = 25

  useEffect(() => {
    apiFetch<Paginated<Ranking>>(`/rankings?tenantSlug=${encodeURIComponent(tenantSlug)}&pageSize=100`).then(({ data: list }) => {
      setRankings(list)
      if (list.length) setActiveRankingId(list[0].id)
    })
  }, [tenantSlug])

  useEffect(() => {
    if (!activeRankingId) return
    setLoading(true)
    apiFetch<RankingResponse>(`/rankings/${activeRankingId}/entries?page=${page}&pageSize=${PER_PAGE}`)
      .then(setData).finally(() => setLoading(false))
  }, [activeRankingId, page])

  function selectRanking(id: string) {
    setActiveRankingId(id)
    setPage(1)
  }
  const activeRanking = rankings.find((r) => r.id === activeRankingId)
  const isDoubles = activeRanking ? ['MD', 'WD', 'XD'].includes(activeRanking.discipline) : false
  const pagination = data?.pagination

  const rankingTitle = activeRanking ? rankingDisplayName(activeRanking.name, activeRanking.year) : 'Ranking'

  return (
    <div className="print-ranking-page space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-warning" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight">Ranking</h1>
          </div>
          <p className="text-sm text-muted-foreground">Classificação oficial dos atletas filiados à federação</p>
        </div>
        {activeRanking && (
          <p className="hidden font-heading text-xl font-semibold print:block">
            {rankingTitle} · {disciplineLabel[activeRanking.discipline] ?? activeRanking.discipline}
          </p>
        )}
        <div className="flex flex-wrap items-start gap-x-6 gap-y-2 print:hidden">
          <ShareControl
            title={activeRanking ? `${truncateText(rankingTitle, 80)} · BirdieAtlas` : share.title}
            text={activeRanking ? buildShareText({ kind: 'ranking', name: rankingTitle }) : share.text}
            images={[
              {
                label: 'Baixar imagem',
                href: shareImagePath(`/r/${tenantSlug}`, activeRankingId ? { ranking: activeRankingId, download: '1' } : { download: '1' }),
                filename: shareImageFilename(rankingTitle, 'top10'),
              },
            ]}
          />
          {data?.data.length ? <PrintButton /> : null}
          {data?.data.length && activeRankingId ? (
            <ExportCsvButton path={`/rankings/${activeRankingId}/entries/export.csv`} fallbackName="ranking.csv" className="print:hidden" />
          ) : null}
        </div>
      </div>

      {/* Seletor */}
      <ChoiceGroup
        legend="Ranking"
        hideLegend
        className="print:hidden"
        options={rankings.map((r) => ({
          value: r.id,
          label: disciplineLabel[r.discipline] ?? r.discipline,
          className: DISCIPLINE_PILL[r.discipline] ?? 'bg-muted text-muted-foreground border-border',
          activeClassName: DISCIPLINE_PILL_ACTIVE[r.discipline] ?? 'bg-primary text-primary-foreground border-primary',
        }))}
        value={activeRankingId}
        onChange={selectRanking}
        optionClassName="rounded-full px-4 py-1.5"
      />

      {/* Tabela */}
      <div data-print-table="" aria-busy={loading} className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div role="status" className="space-y-0">
            <span className="sr-only">Carregando classificação…</span>
            {Array.from({ length: PER_PAGE }).map((_, i) => (
              <div key={i} aria-hidden="true" className="grid grid-cols-[3rem_1fr_auto] gap-4 px-5 py-3.5 border-b border-border/50 motion-safe:animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-40 bg-muted rounded" />
                  {isDoubles && <div className="h-3 w-32 bg-muted rounded" />}
                </div>
                <div className="h-4 w-16 bg-muted rounded self-center" />
              </div>
            ))}
          </div>
        ) : !data?.data.length ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="font-medium">Nenhuma entrada encontrada</p>
          </div>
        ) : (
          <div tabIndex={0} role="region" aria-label="Classificação" className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left">
              <caption className="sr-only">{rankingTitle}: classificação por pontos</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th scope="col" className="w-12 px-5 py-3">Posição</th>
                  <th scope="col" className="px-2 py-3">{isDoubles ? 'Dupla' : 'Atleta'}</th>
                  <th scope="col" className="px-5 py-3 text-right">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((entry) => {
                  const isTop3 = entry.position <= 3
                  return (
                    <tr key={entry.id} data-print-row=""
                      className={`border-b border-border/50 last:border-0 ${isTop3 ? 'bg-medal-gold/10' : ''}`}
                    >
                      <td className="px-5 py-3.5">
                        <PositionBadge pos={entry.position} />
                        <span className="sr-only">{entry.position}º</span>
                      </td>

                      <td className="min-w-0 px-2 py-3.5">
                        {isDoubles ? (
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                            <span className="font-medium text-sm">
                              <Link href={`/a/${entry.athleteId}`} className="inline-flex min-h-6 items-center hover:underline hover:text-foreground transition-colors">
                                {entry.athlete?.name ?? '—'}
                              </Link>
                              {' & '}
                              {entry.athlete2Id ? (
                                <Link href={`/a/${entry.athlete2Id}`} className="inline-flex min-h-6 items-center hover:underline hover:text-foreground transition-colors">
                                  {entry.athlete2?.name ?? '—'}
                                </Link>
                              ) : (
                                <span>{entry.athlete2?.name ?? '—'}</span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                            <Link href={`/a/${entry.athleteId}`}
                              className="inline-flex min-h-6 items-center font-medium text-sm hover:underline hover:text-foreground transition-colors"
                            >
                              {entry.athlete?.name ?? '—'}
                            </Link>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-semibold tabular-nums ${
                          isTop3 ? 'text-warning text-base' : 'text-sm text-foreground'
                        }`}>
                          {entry.totalPoints.toLocaleString('pt-BR')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {pagination && pagination.totalPages > 1 && (
        <nav aria-label="Paginação da classificação" className="flex items-center justify-between print:justify-start">
          <p className="text-sm text-muted-foreground">
            {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, pagination.total)} de {pagination.total} atletas
          </p>
          <div className="flex items-center gap-2 print:hidden">
            <button type="button" aria-label="Página anterior" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="text-sm font-medium px-3">{page} / {pagination.totalPages}</span>
            <button type="button" aria-label="Próxima página" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
