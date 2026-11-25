import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ApiError, apiFetch } from '@/lib/api'
import { formatTvTime } from '@/lib/live'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { BackLink } from '@/components/public/back-link'
import { EmptyNotice } from '@/components/public/notices'
import { ROWS } from '@/components/public/rows'

// Partidas de um jogador no torneio ("Encontre sua próxima partida"): jogadas, a atual, byes e a próxima se vencer.
// Muda a cada resultado: renderiza por requisição.
export const dynamic = 'force-dynamic'

// Mesmo fuso das súmulas: o servidor pode rodar em UTC.
const TIME_ZONE = 'America/Sao_Paulo'

type PageProps = { params: Promise<{ slug: string; athleteId: string }> }

type PlayerMatch = {
  matchId: string
  categoryName: string
  roundLabel: string
  kind: 'bye' | 'rest' | 'played' | 'live' | 'upcoming'
  opponent: string | null
  result: 'won' | 'lost' | null
  score: string | null
  courtNumber: number | null
  scheduledAt: string | null
  ifWin: { roundLabel: string; opponent: string } | null
}

type PlayerSchedule = {
  tournament: { id: string; name: string; slug: string }
  athlete: { id: string; name: string }
  matches: PlayerMatch[]
  /** Partida em destaque (ao vivo ou a próxima pelo horário), calculada na API. */
  nextMatchId: string | null
}

/** 404 do torneio ou do jogador vira página de não encontrado; outra falha sobe para o error boundary. */
const load = cache(async (slug: string, athleteId: string): Promise<PlayerSchedule> => {
  try {
    const tournament = await apiFetch<{ id: string }>(`/tournaments/by-slug/${encodeURIComponent(slug)}`)
    return await apiFetch<PlayerSchedule>(`/tournaments/${tournament.id}/players/${encodeURIComponent(athleteId)}/matches`)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound()
    throw err
  }
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, athleteId } = await params
  const { athlete, tournament } = await load(slug, athleteId)
  return { title: `${athlete.name} · ${tournament.name} · BirdieAtlas` }
}


function StatusChip({ match: m }: { match: PlayerMatch }) {
  if (m.kind === 'live') return <Badge variant="live">Ao vivo</Badge>
  if (m.kind === 'bye') return <Badge variant="secondary">Bye</Badge>
  if (m.kind === 'rest') return <Badge variant="secondary">Folga</Badge>
  if (m.kind === 'played') {
    return (
      <Badge variant="secondary" className={m.result === 'won' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}>
        {m.result === 'won' ? 'Vitória' : m.result === 'lost' ? 'Derrota' : 'Encerrada'}
      </Badge>
    )
  }
  return <Badge variant="secondary" className="bg-muted text-muted-foreground">A jogar</Badge>
}

function MatchRow({ match: m }: { match: PlayerMatch }) {
  const time = formatTvTime(m.scheduledAt, new Date(), TIME_ZONE)
  return (
    <li className="space-y-1 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusChip match={m} />
        <span className="text-sm font-semibold">{m.roundLabel}</span>
        {m.courtNumber != null && <span className="font-heading text-base font-bold">Quadra {m.courtNumber}</span>}
        {time && <span className="text-sm text-muted-foreground">{time}</span>}
      </div>
      {m.kind === 'bye' ? (
        <p>Avança direto para a fase seguinte, sem jogar.</p>
      ) : m.kind === 'rest' ? (
        <p>Folga nesta rodada: conta como vitória.</p>
      ) : (
        <p className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="min-w-0 break-words">
            <span className="text-muted-foreground">× </span>
            <span className="font-medium">{m.opponent ?? 'A definir'}</span>
          </span>
          {m.score && <span className="font-heading text-lg font-bold tabular-nums">{m.score}</span>}
        </p>
      )}
      {m.ifWin && (
        <p className="text-sm text-muted-foreground">
          Se vencer: {m.ifWin.roundLabel} contra {m.ifWin.opponent}
        </p>
      )}
    </li>
  )
}

export default async function PlayerSchedulePage({ params }: PageProps) {
  const { slug, athleteId } = await params
  const { tournament, athlete, matches, nextMatchId } = await load(slug, athleteId)
  // Regra da Próxima Ação: a partida ao vivo ou a próxima a jogar vem em destaque no topo, e sai da lista abaixo.
  const next = matches.find((m) => m.matchId === nextMatchId)
  const rest = matches.filter((m) => m !== next)
  const categories = [...new Set(rest.map((m) => m.categoryName))]
  const categoryCount = new Set(matches.map((m) => m.categoryName)).size

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <BackLink href={`/t/${tournament.slug}`}>{tournament.name}</BackLink>
        <h1 className="break-words font-heading text-3xl font-bold leading-tight md:text-4xl">{athlete.name}</h1>
        {matches.length > 0 && (
          <p className="text-muted-foreground">
            {matches.length} {matches.length === 1 ? 'partida' : 'partidas'} em {categoryCount} {categoryCount === 1 ? 'categoria' : 'categorias'}
          </p>
        )}
      </header>

      {matches.length === 0 ? (
        <EmptyNotice>As partidas de {athlete.name} aparecem aqui quando a chave da categoria for sorteada.</EmptyNotice>
      ) : (
        <>
          {next && (
            <section aria-labelledby="next-title" className="space-y-3">
              <h2 id="next-title" className="text-2xl">{next.kind === 'live' ? 'Jogando agora' : 'Próxima partida'}</h2>
              <ul className={cn(ROWS, 'border-primary/40')}>
                <MatchRow match={next} />
              </ul>
              <p className="text-sm text-muted-foreground">{next.categoryName}</p>
            </section>
          )}
          {categories.map((category, i) => (
            <section key={category} aria-labelledby={`cat-${i}`} className="space-y-3">
              <h2 id={`cat-${i}`} className="text-2xl">{category}</h2>
              <ul className={ROWS}>
                {rest.filter((m) => m.categoryName === category).map((m) => <MatchRow key={m.matchId} match={m} />)}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
