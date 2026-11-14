import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ApiError, apiFetch } from '@/lib/api'
import { TvBoard } from '@/components/live/tv-board'
import { RefreshWhileFailing } from '@/components/live/refresh-while-failing'

// Telão do torneio, fora do layout público: sem cabeçalho nem navegação, para TV ou projetor.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

// `cache`: metadados e página compartilham a mesma busca na requisição.
const loadTournament = cache(async (slug: string): Promise<{ id: string; name: string } | 'error'> => {
  try {
    return await apiFetch<{ id: string; name: string }>(`/tournaments/by-slug/${encodeURIComponent(slug)}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    return 'error'
  }
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const tournament = await loadTournament(slug)
  return { title: tournament === 'error' ? 'Telão · BirdieAtlas' : `Telão · ${tournament.name} · BirdieAtlas` }
}

export default async function TvPage({ params }: PageProps) {
  const { slug } = await params
  const tournament = await loadTournament(slug)
  if (tournament === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
        <RefreshWhileFailing message="Não foi possível carregar o torneio. Verifique a conexão com a API." />
      </main>
    )
  }
  return <TvBoard tournamentId={tournament.id} slug={slug} name={tournament.name} />
}
