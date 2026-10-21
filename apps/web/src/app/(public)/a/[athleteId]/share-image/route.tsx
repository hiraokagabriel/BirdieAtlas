import { loadAthleteShare } from '@/lib/share-data'
import { AthleteCard } from '@/lib/share-image/cards'
import { renderShareImage } from '@/lib/share-image/respond'

// Cartão do atleta, 1200x630. `?download=1` devolve o PNG como anexo.
export async function GET(request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params
  const load = await loadAthleteShare(athleteId)
  return renderShareImage({
    load,
    format: 'landscape',
    render: (card, host) => <AthleteCard model={card} host={host} />,
    notFoundHeadline: 'Atleta não encontrado',
    download: new URL(request.url).searchParams.has('download')
      ? { name: load.status === 'ok' ? load.card.name : 'atleta' }
      : null,
  })
}
