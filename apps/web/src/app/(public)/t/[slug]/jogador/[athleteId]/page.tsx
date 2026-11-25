import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ApiError, apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { BackLink } from '@/components/public/back-link'
import { EmptyNotice } from '@/components/public/notices'
import { ROWS } from '@/components/public/rows'
import { MatchRow, type PlayerMatch } from '@/components/public/player-match-row'

// Partidas de um jogador no torneio ("Encontre sua próxima partida"): jogadas, a atual, byes e a próxima se vencer.
// Muda a cada resultado: renderiza por requisição.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string; athleteId: string }> }

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
                <MatchRow match={next} showCategory />
              </ul>
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
