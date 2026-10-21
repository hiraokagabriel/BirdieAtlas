import type { Metadata } from 'next'
import { TournamentView } from '@/components/public/tournament-view'
import { shareImagePath } from '@/lib/share'
import { loadTournamentShare } from '@/lib/share-data'
import { shareMetadata } from '@/lib/share-metadata'

// O resultado muda a cada partida e a cada encerramento; renderiza por requisição.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const load = await loadTournamentShare(slug)
  if (load.status !== 'ok') return { title: 'Torneio · BirdieAtlas' }
  return shareMetadata({
    title: load.title,
    description: load.description,
    path: `/t/${slug}`,
    imagePath: shareImagePath(`/t/${slug}`),
    imageAlt: `Cartão de ${load.card.name}`,
  })
}

export default async function PublicTournamentPage({ params }: PageProps) {
  const { slug } = await params
  const load = await loadTournamentShare(slug)
  // Sem dados (API fora do ar ou torneio inexistente) a view cuida do próprio estado de erro/404;
  // o texto de compartilhamento só perde o resumo.
  const share =
    load.status === 'ok'
      ? { title: load.title, text: load.description }
      : { title: 'Torneio · BirdieAtlas', text: 'Chave e resultados no BirdieAtlas.' }
  return <TournamentView slug={slug} share={share} />
}
