'use client'

import { useEffect, useState } from 'react'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { disciplineLabel } from '@/lib/labels'
import { BackLink } from '@/components/public/back-link'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'
import { PlacementBadge } from '@/components/public/placement-badge'
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

export function RankingView({ tenantSlug, share, initialRankingId }: { tenantSlug: string; share: RankingShare; initialRankingId?: string }) {
  // null enquanto a lista de rankings não chegou (esqueleto, não "nenhum ranking").
  const [rankings, setRankings] = useState<Ranking[] | null>(null)
  const [activeRankingId, setActiveRankingId] = useState('')
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const PER_PAGE = 25

  useEffect(() => {
    apiFetch<Paginated<Ranking>>(`/rankings?tenantSlug=${encodeURIComponent(tenantSlug)}&pageSize=100`)
      .then(({ data: list }) => {
        setRankings(list)
        // `?ranking=<id>` (chip de modalidade do perfil) escolhe o ranking; sem ele ou desconhecido, o primeiro.
        if (list.length) setActiveRankingId((list.find((r) => r.id === initialRankingId) ?? list[0]).id)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Erro inesperado.'))
  }, [tenantSlug, initialRankingId])

  useEffect(() => {
    if (!activeRankingId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch<RankingResponse>(`/rankings/${activeRankingId}/entries?page=${page}&pageSize=${PER_PAGE}`)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Erro inesperado.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeRankingId, page])

  function selectRanking(id: string) {
    setActiveRankingId(id)
    setPage(1)
  }
  const activeRanking = rankings?.find((r) => r.id === activeRankingId)
  const isDoubles = activeRanking ? ['MD', 'WD', 'XD'].includes(activeRanking.discipline) : false
  const pagination = data?.pagination

  const rankingTitle = activeRanking ? rankingDisplayName(activeRanking.name, activeRanking.year) : 'Ranking'

  return (
    <div className="print-ranking-page space-y-8">
      <header className="space-y-3">
        <BackLink />
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-bold leading-tight md:text-4xl">Ranking</h1>
          <p className="text-muted-foreground">Classificação oficial dos atletas filiados à federação.</p>
        </div>
        {activeRanking && (
          <p className="hidden font-heading text-xl font-semibold print:block">
            {rankingTitle} · {disciplineLabel(activeRanking.discipline)}
          </p>
        )}
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2 print:hidden">
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
      </header>

      {/* Seletor */}
      <ChoiceGroup
        legend="Ranking"
        hideLegend
        className="print:hidden"
        scroll
        options={(rankings ?? []).map((r) => ({
          value: r.id,
          label: `${disciplineLabel(r.discipline)} ${r.year}`,
          className: 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
        }))}
        value={activeRankingId}
        onChange={selectRanking}
        optionClassName="px-4 font-semibold"
      />

      {/* Tabela */}
      {error ? (
        <ErrorNotice>Não foi possível carregar o ranking: {error}</ErrorNotice>
      ) : rankings !== null && !loading && !data?.data.length ? (
        <EmptyNotice>
          {rankings.length === 0
            ? 'Nenhum ranking publicado ainda. A classificação aparece aqui quando a federação publicar.'
            : 'Este ranking ainda não tem atletas classificados. Os pontos aparecem depois do primeiro torneio encerrado.'}
        </EmptyNotice>
      ) : (
      <div data-print-table="" aria-busy={loading} className="overflow-hidden rounded-lg border border-border bg-card">
        {rankings === null || loading || !data ? (
          <div role="status" className="space-y-0">
            <span className="sr-only">Carregando classificação…</span>
            {Array.from({ length: PER_PAGE }).map((_, i) => (
              <div key={i} aria-hidden="true" className="grid grid-cols-[3rem_1fr_auto] gap-4 border-b border-border/50 px-5 py-3.5 motion-safe:animate-pulse">
                <div className="size-8 rounded-md bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-40 bg-muted rounded" />
                  {isDoubles && <div className="h-3 w-32 bg-muted rounded" />}
                </div>
                <div className="h-4 w-16 bg-muted rounded self-center" />
              </div>
            ))}
          </div>
        ) : (
          <div tabIndex={0} role="region" aria-label="Classificação" className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left">
              <caption className="sr-only">{rankingTitle}: classificação por pontos</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[0.8125rem] font-semibold text-muted-foreground">
                  <th scope="col" className="w-12 px-5 py-3">Posição</th>
                  <th scope="col" className="px-2 py-3">{isDoubles ? 'Dupla' : 'Atleta'}</th>
                  <th scope="col" className="px-5 py-3 text-right">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((entry) => {
                  return (
                    <tr key={entry.id} data-print-row="" className="border-b border-border last:border-0">
                      <td className="px-5 py-1.5">
                        <PlacementBadge placement={entry.position} className="size-8 text-sm" />
                      </td>

                      <td className="min-w-0 px-2 py-1.5 font-medium">
                        <Link href={`/a/${entry.athleteId}`} className="inline-flex min-h-11 items-center rounded-sm hover:underline">
                          {entry.athlete?.name ?? '—'}
                        </Link>
                        {isDoubles && (
                          <>
                            {' / '}
                            {entry.athlete2Id ? (
                              <Link href={`/a/${entry.athlete2Id}`} className="inline-flex min-h-11 items-center rounded-sm hover:underline">
                                {entry.athlete2?.name ?? '—'}
                              </Link>
                            ) : (
                              <span>{entry.athlete2?.name ?? '—'}</span>
                            )}
                          </>
                        )}
                      </td>

                      <td className="px-5 py-1.5 text-right font-heading text-lg font-bold tabular-nums">
                        {entry.totalPoints.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Paginação */}
      {pagination && pagination.totalPages > 1 && (
        <nav aria-label="Paginação da classificação" className="flex items-center justify-between print:justify-start">
          <p className="text-sm text-muted-foreground">
            {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, pagination.total)} de {pagination.total} atletas
          </p>
          <div className="flex items-center gap-2 print:hidden">
            <button type="button" aria-label="Página anterior" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="inline-flex size-(--control-h) items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="text-sm font-medium px-3">{page} / {pagination.totalPages}</span>
            <button type="button" aria-label="Próxima página" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="inline-flex size-(--control-h) items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
