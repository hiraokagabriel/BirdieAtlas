import { loadRankingShare } from '@/lib/share-data'
import { RankingCard } from '@/lib/share-image/cards'
import { renderShareImage } from '@/lib/share-image/respond'

// Top 10 do ranking, 1200x630. `?ranking=<id>` escolhe o ranking (padrão: o primeiro da federação);
// `?download=1` devolve o PNG como anexo.
export async function GET(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params
  const query = new URL(request.url).searchParams
  const load = await loadRankingShare(tenantSlug, query.get('ranking'))
  return renderShareImage({
    load,
    format: 'landscape',
    render: (card, host) => <RankingCard model={card} host={host} />,
    notFoundHeadline: 'Ranking não encontrado',
    download: query.has('download')
      ? { name: load.status === 'ok' ? `${load.card.title}-${load.card.year}` : 'ranking', suffix: 'top10' }
      : null,
  })
}
