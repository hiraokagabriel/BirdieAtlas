import type { Metadata } from 'next'
import { RankingView } from '@/components/public/ranking-view'
import { shareImagePath } from '@/lib/share'
import { loadRankingShare } from '@/lib/share-data'
import { shareMetadata } from '@/lib/share-metadata'

// A classificação muda a cada torneio encerrado; renderiza por requisição.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ tenantSlug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantSlug } = await params
  const load = await loadRankingShare(tenantSlug, null)
  if (load.status !== 'ok') return { title: 'Ranking · BirdieAtlas' }
  return shareMetadata({
    title: load.title,
    description: load.description,
    path: `/r/${tenantSlug}`,
    imagePath: shareImagePath(`/r/${tenantSlug}`),
    imageAlt: `Top 10 do ranking ${load.card.title}`,
  })
}

export default async function PublicRankingPage({ params }: PageProps) {
  const { tenantSlug } = await params
  const load = await loadRankingShare(tenantSlug, null)
  const share =
    load.status === 'ok'
      ? { title: load.title, text: load.description }
      : { title: 'Ranking · BirdieAtlas', text: 'Classificação atualizada no BirdieAtlas.' }
  return <RankingView tenantSlug={tenantSlug} share={share} />
}
