import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Calendar, Globe, Shield, Users } from 'lucide-react'
import { fetchAthleteProfile, fetchAthleteStats } from '@/lib/public-athlete'
import { summarizeAthlete } from '@/lib/athlete-stats'
import { countryName, formatDate, formatPoints } from '@/lib/format'
import { disciplineLabel, isDoublesDiscipline } from '@/lib/labels'
import { AthleteAvatar } from '@/components/public/athlete-avatar'
import { AthleteStatsSection } from '@/components/public/athlete-stats-section'
import { BackLink } from '@/components/public/back-link'
import { DisciplineChip } from '@/components/public/discipline-chip'
import { HeadToHeadPicker } from '@/components/public/head-to-head-picker'
import { LevelBadge } from '@/components/public/level-badge'
import { EmptyNotice } from '@/components/public/notices'
import { PlacementBadge } from '@/components/public/placement-badge'
import { INLINE_LINK, ROWS } from '@/components/public/rows'
import { STAT_GRID, StatTile } from '@/components/public/stat-tile'
import { StatusBadge } from '@/components/public/status-badge'
import { ShareControl } from '@/components/shared/share-control'
import { buildShareText, shareImageFilename, shareImagePath } from '@/lib/share'
import { buildAthleteCard } from '@/lib/share-cards'
import { shareMetadata } from '@/lib/share-metadata'

// O perfil muda a cada torneio finalizado; renderiza por requisição.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ athleteId: string }> }

/** 404 vira página de "não encontrado"; qualquer outra falha sobe para o error boundary da rota. */
const loadProfile = cache(async (athleteId: string) => {
  const profile = await fetchAthleteProfile(athleteId)
  if (!profile) notFound()
  return profile
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { athleteId } = await params
  const card = buildAthleteCard(await loadProfile(athleteId))
  return shareMetadata({
    title: `${card.name} · BirdieAtlas`,
    description: buildShareText({ kind: 'athlete', name: card.name }),
    path: `/a/${athleteId}`,
    imagePath: shareImagePath(`/a/${athleteId}`),
    imageAlt: `Cartão de ${card.name}`,
  })
}

export default async function PublicAthletePage({ params }: PageProps) {
  const { athleteId } = await params
  const [{ athlete, currentClub, rankingPositions, tournamentHistory }, matchStats] = await Promise.all([
    loadProfile(athleteId),
    fetchAthleteStats(athleteId),
  ])

  const summary = summarizeAthlete(tournamentHistory, rankingPositions)
  const rankings = [...rankingPositions].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
  const disciplines = [...new Set(tournamentHistory.map((h) => h.discipline).filter(Boolean))]
  const place = currentClub ? [currentClub.city, currentClub.state].filter(Boolean).join(' / ') : ''

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <BackLink />
        <div className="flex items-center gap-4">
          <AthleteAvatar name={athlete.name} photoUrl={athlete.photoUrl} size={64} />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="break-words font-heading text-3xl font-bold leading-tight md:text-4xl">{athlete.name}</h1>
              {!athlete.active && (
                <span className="inline-flex h-5.5 items-center rounded-sm bg-muted px-1.5 text-xs font-semibold text-muted-foreground">Inativo</span>
              )}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {currentClub?.clubName ? (
                <li className="flex min-w-0 items-center gap-1.5">
                  <Shield className="size-4 shrink-0" aria-hidden="true" />
                  {currentClub.clubSlug ? (
                    <Link href={`/c/${currentClub.clubSlug}`} className={`font-medium text-foreground ${INLINE_LINK}`}>
                      {currentClub.clubName}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{currentClub.clubName}</span>
                  )}
                  {place && <span>· {place}</span>}
                </li>
              ) : (
                <li>Sem clube ativo</li>
              )}
              <li className="flex items-center gap-1.5">
                <Users className="size-4 shrink-0" aria-hidden="true" />
                {athlete.gender === 'M' ? 'Masculino' : 'Feminino'}
              </li>
              {athlete.nationality && (
                <li className="flex items-center gap-1.5">
                  <Globe className="size-4 shrink-0" aria-hidden="true" />
                  {countryName(athlete.nationality)}
                </li>
              )}
              {disciplines.length > 0 && (
                <li className="flex items-center">
                  <ul aria-label="Modalidades disputadas" className="flex flex-wrap gap-1.5">
                    {disciplines.map((d) => (
                      <li key={d}>
                        <DisciplineChip discipline={d} />
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          </div>
        </div>

        <ShareControl
          title={`${athlete.name} · BirdieAtlas`}
          text={buildShareText({ kind: 'athlete', name: athlete.name })}
          images={[
            {
              label: 'Baixar imagem',
              href: shareImagePath(`/a/${athleteId}`, { download: '1' }),
              filename: shareImageFilename(athlete.name),
            },
          ]}
        />
      </header>

      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          Resumo
        </h2>
        <dl className={STAT_GRID}>
          <StatTile label="Torneios disputados" value={summary.tournaments} />
          <StatTile label="Títulos" value={summary.titles} />
          <StatTile label="Pódios" value={summary.podiums} hint="1º ao 3º lugar" />
          <StatTile
            label="Melhor posição"
            value={summary.bestRankingPosition !== null ? `${summary.bestRankingPosition}º` : '—'}
            hint={summary.bestRankingPosition !== null ? 'em ranking' : 'fora dos rankings'}
          />
        </dl>
      </section>

      <section aria-labelledby="rankings-title" className="space-y-3">
        <h2 id="rankings-title" className="text-2xl">
          Rankings
        </h2>
        {rankings.length === 0 ? (
          <EmptyNotice>Este atleta ainda não aparece em nenhum ranking.</EmptyNotice>
        ) : (
          <ul className={ROWS}>
            {rankings.map((r) => (
              <li key={`${r.rankingId}-${r.partnerId ?? 'solo'}`} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <PlacementBadge placement={r.position} />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">{r.rankingName}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{disciplineLabel(r.discipline)}</span>
                    {r.year > 0 && <span>{r.year}</span>}
                    {isDoublesDiscipline(r.discipline) && r.partnerName && r.partnerId && (
                      <span>
                        com{' '}
                        <Link href={`/a/${r.partnerId}`} className={INLINE_LINK}>
                          {r.partnerName}
                        </Link>
                      </span>
                    )}
                  </p>
                </div>
                {r.totalPoints !== null && (
                  <p className="shrink-0 font-heading text-xl font-bold tabular-nums">
                    {formatPoints(r.totalPoints)}
                    <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">pts</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AthleteStatsSection stats={matchStats} />

      <HeadToHeadPicker athleteId={athlete.id} />

      <section aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="text-2xl">
          Histórico de torneios
        </h2>
        {tournamentHistory.length === 0 ? (
          <EmptyNotice>Nenhum torneio confirmado encontrado para este atleta.</EmptyNotice>
        ) : (
          <ul className={ROWS}>
            {tournamentHistory.map((entry) => (
              <li key={entry.registrationId} className="flex min-h-14 items-center gap-3 px-4 py-1.5">
                <PlacementBadge placement={entry.finalPlacement} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold">
                    {entry.tournamentSlug ? (
                      <Link href={`/t/${entry.tournamentSlug}`} className={`inline-flex min-h-11 items-center ${INLINE_LINK}`}>
                        {entry.tournamentName}
                      </Link>
                    ) : (
                      entry.tournamentName
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {entry.categoryName || disciplineLabel(entry.discipline)}
                      {entry.seed !== null && ` · cabeça de chave ${entry.seed}`}
                    </span>
                    <LevelBadge level={entry.level} className="bg-muted text-muted-foreground" />
                    {entry.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3.5" aria-hidden="true" />
                        {formatDate(entry.startDate, 'medium')}
                      </span>
                    )}
                    {entry.tournamentStatus !== 'completed' && <StatusBadge status={entry.tournamentStatus} />}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">A colocação aparece quando o torneio é encerrado.</p>
      </section>
    </div>
  )
}
