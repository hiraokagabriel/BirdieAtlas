import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Award, Calendar, Globe, MapPin, Trophy, Users } from 'lucide-react'
import { fetchAthleteProfile } from '@/lib/public-athlete'
import { summarizeAthlete } from '@/lib/athlete-stats'
import { countryName, formatDate, formatPoints } from '@/lib/format'
import { disciplineLabel, isDoublesDiscipline } from '@/lib/labels'
import { AthleteAvatar } from '@/components/public/athlete-avatar'
import { LevelBadge } from '@/components/public/level-badge'
import { EmptyNotice } from '@/components/public/notices'
import { PlacementBadge } from '@/components/public/placement-badge'
import { StatTile } from '@/components/public/stat-tile'
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
  const { athlete, currentClub, rankingPositions, tournamentHistory } = await loadProfile(athleteId)

  const summary = summarizeAthlete(tournamentHistory, rankingPositions)
  const rankings = [...rankingPositions].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
  const disciplines = [...new Set(tournamentHistory.map((h) => h.discipline).filter(Boolean))]
  const place = currentClub ? [currentClub.city, currentClub.state].filter(Boolean).join(' / ') : ''

  return (
    <div className="space-y-10">
      <header className="overflow-hidden rounded-2xl border border-border bg-card">
        <div aria-hidden="true" className="h-3 bg-primary" />
        <div className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:items-center sm:text-left md:gap-8 md:p-8">
          <AthleteAvatar name={athlete.name} photoUrl={athlete.photoUrl} size={112} />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
              <h1 className="text-4xl leading-none md:text-5xl">{athlete.name}</h1>
              {!athlete.active && (
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Inativo</span>
              )}
            </div>

            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground sm:justify-start">
              {currentClub?.clubName ? (
                <li className="flex items-center gap-1.5">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" />
                  {currentClub.clubSlug ? (
                    <Link
                      href={`/c/${currentClub.clubSlug}`}
                      className="rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
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
            </ul>

            <ShareControl
              className="flex flex-col items-center sm:items-start"
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

            {disciplines.length > 0 && (
              <ul aria-label="Modalidades disputadas" className="flex flex-wrap justify-center gap-2 sm:justify-start">
                {disciplines.map((d) => (
                  <li key={d} className="rounded-full bg-secondary px-3 py-0.5 text-xs font-semibold text-secondary-foreground">
                    {disciplineLabel(d)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          Resumo
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Torneios disputados" value={summary.tournaments} />
          <StatTile label="Títulos" value={summary.titles} highlight={summary.titles > 0} />
          <StatTile label="Pódios" value={summary.podiums} hint="1º ao 3º lugar" />
          <StatTile
            label="Melhor posição"
            value={summary.bestRankingPosition !== null ? `${summary.bestRankingPosition}º` : '—'}
            hint={summary.bestRankingPosition !== null ? 'em ranking' : 'fora dos rankings'}
          />
        </dl>
      </section>

      <section aria-labelledby="rankings-title" className="space-y-4">
        <h2 id="rankings-title" className="text-2xl">
          Rankings
        </h2>
        {rankings.length === 0 ? (
          <EmptyNotice>Este atleta ainda não aparece em nenhum ranking.</EmptyNotice>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {rankings.map((r) => (
              <li key={`${r.rankingId}-${r.partnerId ?? 'solo'}`} className="flex items-center gap-3 px-4 py-3">
                <PlacementBadge placement={r.position} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.rankingName}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{disciplineLabel(r.discipline)}</span>
                    {r.year > 0 && <span>{r.year}</span>}
                    {isDoublesDiscipline(r.discipline) && r.partnerName && r.partnerId && (
                      <span>
                        com{' '}
                        <Link
                          href={`/a/${r.partnerId}`}
                          className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {r.partnerName}
                        </Link>
                      </span>
                    )}
                  </p>
                </div>
                {r.totalPoints !== null && (
                  <p className="shrink-0 font-heading text-xl font-semibold tabular-nums">
                    {formatPoints(r.totalPoints)}
                    <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">pts</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-title" className="space-y-4">
        <h2 id="history-title" className="text-2xl">
          Histórico de torneios
        </h2>
        {tournamentHistory.length === 0 ? (
          <EmptyNotice>Nenhum torneio confirmado encontrado para este atleta.</EmptyNotice>
        ) : (
          <ul className="space-y-2">
            {tournamentHistory.map((entry) => (
              <li
                key={entry.registrationId}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <PlacementBadge placement={entry.finalPlacement} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold">
                    {entry.tournamentSlug ? (
                      <Link
                        href={`/t/${entry.tournamentSlug}`}
                        className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {entry.tournamentName}
                      </Link>
                    ) : (
                      entry.tournamentName
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.categoryName || disciplineLabel(entry.discipline)}
                    {entry.seed !== null && ` · cabeça de chave ${entry.seed}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <LevelBadge level={entry.level} />
                    {entry.startDate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="size-3" aria-hidden="true" />
                        {formatDate(entry.startDate, 'medium')}
                      </span>
                    )}
                    {entry.tournamentStatus !== 'completed' && <StatusBadge status={entry.tournamentStatus} />}
                  </div>
                </div>
                {entry.finalPlacement !== null && entry.finalPlacement <= 3 && (
                  <Trophy className="hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Award className="size-3.5" aria-hidden="true" />
          A colocação aparece quando o torneio é encerrado.
        </p>
      </section>
    </div>
  )
}
