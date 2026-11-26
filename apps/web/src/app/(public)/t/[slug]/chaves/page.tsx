import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ApiError, apiFetch } from '@/lib/api'
import type { BracketEntry, BracketMatch, SetScore } from '@/lib/bracket'
import { formatDateRange } from '@/lib/format'
import { BracketDraw } from '@/components/bracket/bracket-draw'
import { BackLink } from '@/components/public/back-link'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'
import { PrintButton } from '@/components/shared/print-button'

// Todas as chaves publicadas do torneio numa página, para divulgar: "Imprimir / Salvar PDF" gera um PDF com uma
// categoria por página (A4 paisagem, cada chave reduzida para caber; ver app/print.css).
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

type Tournament = { id: string; name: string; slug: string; startDate: string; endDate: string; city: string | null; state: string | null }
type PublishedBracket = {
  category: { id: string; name: string; discipline: string; drawType: string }
  draw: { id: string; config?: { advancePerGroup?: number } | null }
  matches: BracketMatch[]
  registrations: BracketEntry[]
  results: SetScore[]
}

const loadTournament = cache(async (slug: string): Promise<Tournament | 'error'> => {
  try {
    return await apiFetch<Tournament>(`/tournaments/by-slug/${encodeURIComponent(slug)}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    return 'error'
  }
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const tournament = await loadTournament(slug)
  return { title: tournament === 'error' ? 'Chaves · BirdieAtlas' : `Chaves · ${tournament.name} · BirdieAtlas` }
}

export default async function AllBracketsPage({ params }: PageProps) {
  const { slug } = await params
  const tournament = await loadTournament(slug)
  if (tournament === 'error') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Chaves</h1>
        <ErrorNotice>Não foi possível carregar o torneio. Tente de novo em instantes.</ErrorNotice>
      </div>
    )
  }

  let brackets: PublishedBracket[] | null = null
  try {
    brackets = await apiFetch<PublishedBracket[]>(`/tournaments/${tournament.id}/brackets`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    console.error('Chaves do torneio:', err)
    brackets = null
  }

  const place = [tournament.city, tournament.state].filter(Boolean).join('/')
  const subtitle = [formatDateRange(tournament.startDate, tournament.endDate), place].filter(Boolean).join(' · ')

  return (
    <div className="print-bracket-page space-y-6">
      <div className="space-y-3 print:hidden">
        <BackLink href={`/t/${tournament.slug}`}>{tournament.name}</BackLink>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chaves · {tournament.name}</h1>
            <p className="text-sm text-muted-foreground">
              Todas as chaves publicadas, uma categoria por página no PDF{brackets && brackets.length > 0 ? ` (${brackets.length} ${brackets.length === 1 ? 'categoria' : 'categorias'})` : ''}.
            </p>
          </div>
          {brackets && brackets.length > 0 && <PrintButton />}
        </div>
      </div>

      {brackets === null ? (
        <ErrorNotice>Não foi possível carregar as chaves. Tente de novo em instantes.</ErrorNotice>
      ) : brackets.length === 0 ? (
        <EmptyNotice>Nenhuma chave publicada neste torneio ainda.</EmptyNotice>
      ) : (
        brackets.map((b) => (
          <section key={b.category.id} className="print-bracket-section space-y-3">
            {/* No papel cada página é uma peça: torneio em cima, categoria em destaque, data e local. */}
            <header className="border-b border-border pb-2">
              <p className="hidden font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground print:block">{tournament.name}</p>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-heading text-2xl font-semibold print:text-3xl">{b.category.name}</h2>
                {subtitle && <p className="hidden text-sm text-muted-foreground print:block">{subtitle}</p>}
              </div>
            </header>
            {/* A categoria inteira (chave, grupos ou rodadas) cabe numa página e amplia o que sobra; o cabeçalho
                acima ocupa ~90 px (110 com folga, porque a medida de tela fica um pouco abaixo da de papel). Até 32 vagas cabe numa página (escala mínima 0,25: o PDF é vetorial e lido com zoom); a de 64 continua na seguinte.
                Formatos em lista (todos contra todos, grupos, suíço) fluem em colunas na largura da folha. */}
            <div
              data-print-fit=""
              data-print-reserved="110"
              data-print-max-scale="1.6"
              data-print-min-scale="0.25"
              {...(b.category.drawType === 'single_elimination' || b.category.drawType === 'double_elimination' ? {} : { 'data-print-flow': '' })}
            >
            <BracketDraw
              matches={b.matches}
              registrations={b.registrations}
              results={b.results}
              activeCategory={b.category}
              drawId={b.draw.id}
              drawType={b.category.drawType}
              {...(b.draw.config?.advancePerGroup ? { advancePerGroup: b.draw.config.advancePerGroup } : {})}
              readonly
            />
            </div>
          </section>
        ))
      )}
    </div>
  )
}
