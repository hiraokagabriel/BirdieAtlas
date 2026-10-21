import { parseShareFormat } from '@/lib/share'
import { loadTournamentShare } from '@/lib/share-data'
import { TournamentCard } from '@/lib/share-image/cards'
import { renderShareImage } from '@/lib/share-image/respond'

// Imagem de compartilhamento do torneio: 1200x630 (padrão) ou `?format=portrait` (1080x1350, pódio).
// `?download=1` devolve o PNG como anexo.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const query = new URL(request.url).searchParams
  const format = parseShareFormat(query.get('format'))
  const load = await loadTournamentShare(slug)
  return renderShareImage({
    load,
    format,
    render: (card, host) => <TournamentCard model={card} format={format} host={host} />,
    notFoundHeadline: 'Torneio não encontrado',
    download: query.has('download')
      ? { name: load.status === 'ok' ? load.card.name : slug, suffix: format === 'portrait' ? 'story' : undefined }
      : null,
  })
}
