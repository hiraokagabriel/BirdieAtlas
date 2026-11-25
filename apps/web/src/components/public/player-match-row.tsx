import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { formatTvTime } from '@/lib/live'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// Linha de partida do jogador ("Encontre sua próxima partida"): usada na página do jogador no torneio e no perfil.

// Mesmo fuso das súmulas: o servidor pode rodar em UTC.
const TIME_ZONE = 'America/Sao_Paulo'

export type PlayerMatch = {
  matchId: string
  categoryId: string
  categoryName: string
  roundLabel: string
  kind: 'bye' | 'rest' | 'played' | 'live' | 'upcoming'
  /** Nome de quem ele enfrenta ou "vencedor de (A × B)"; `null` em bye, folga ou a definir. */
  opponent: string | null
  opponentKnown: boolean
  result: 'won' | 'lost' | null
  score: string | null
  courtNumber: number | null
  scheduledAt: string | null
  ifWin: { roundLabel: string; opponent: string | null } | null
  opponentPlayers: Player[]
  pending: { via: 'vencedor' | 'perdedor'; sides: Player[][] } | null
}

type Player = { id: string; name: string }

// Nome que é link, sem mudar a cor do texto: sublinhado discreto que acende no hover e no foco.
const NAME_LINK = 'rounded-sm underline decoration-border underline-offset-4 hover:decoration-primary'

/** Atletas de um lado, cada um com link ao perfil, separados por " / ". */
function PlayerLinks({ players }: { players: Player[] }) {
  return (
    <>
      {players.map((p, i) => (
        <span key={p.id}>
          {i > 0 && ' / '}
          <Link href={`/a/${p.id}`} className={NAME_LINK}>{p.name}</Link>
        </span>
      ))}
    </>
  )
}

export function StatusChip({ match: m }: { match: PlayerMatch }) {
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

/** Hora em destaque e o dia, se não for hoje ("15/03 14:30" vira dia "15/03" e hora "14:30"). */
function splitTime(iso: string | null): { clock: string; day: string } {
  const text = formatTvTime(iso, new Date(), TIME_ZONE)
  const [first, second] = text.split(' ')
  return second ? { clock: second, day: first ?? '' } : { clock: text, day: '' }
}

/**
 * Linha de partida como o placar do ginásio, em três colunas: quando e onde (hora grande e quadra; Bye/Folga no
 * lugar), o confronto (adversário em destaque) e o caminho colado ao confronto (placar ao vivo/final e "Se vencer →
 * fase", com o adversário dela). No celular, empilha. Ver docs/DESIGN.md, "Linha de partida".
 * `highlight`: a próxima partida dele, com fundo e "Próxima" (no perfil, onde as partidas a jogar ficam juntas).
 */
export function MatchRow({ match: m, showCategory = false, highlight = false, tournamentSlug, athleteId }: {
  match: PlayerMatch
  showCategory?: boolean
  highlight?: boolean
  tournamentSlug?: string
  /** O dono da página: em simples, o nome do adversário leva ao confronto direto dos dois. */
  athleteId?: string
}) {
  const where = showCategory ? `${m.categoryName} · ${m.roundLabel}` : m.roundLabel
  const { clock, day } = splitTime(m.scheduledAt)
  const free = m.kind === 'bye' || m.kind === 'rest'
  const side = m.score || m.ifWin
  return (
    <li
      className={cn(
        'grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[6rem_minmax(0,1fr)]',
        side && 'lg:grid-cols-[6rem_minmax(0,1.2fr)_minmax(0,1fr)]',
        highlight && 'bg-secondary',
      )}
    >
      <div className="flex items-baseline gap-x-4 sm:block sm:space-y-1">
        {free ? (
          <p className="font-heading text-2xl font-bold leading-none">{m.kind === 'bye' ? 'Bye' : 'Folga'}</p>
        ) : clock ? (
          <p className="font-heading text-2xl font-bold leading-none tabular-nums">{clock}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem horário</p>
        )}
        {day && <p className="text-xs tabular-nums text-muted-foreground">{day}</p>}
        {!free && (m.courtNumber != null ? (
          <p className="flex items-baseline gap-1">
            <span className="text-xs font-semibold text-muted-foreground">Quadra</span>
            <span className="font-heading text-xl font-bold leading-none tabular-nums">{m.courtNumber}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Quadra a definir</p>
        ))}
      </div>

      <div className="min-w-0 space-y-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {highlight && m.kind !== 'live' && <span className="font-semibold text-primary">Próxima</span>}
          <StatusChip match={m} />
          {tournamentSlug ? (
            <Link href={`/t/${tournamentSlug}?categoria=${m.categoryId}`} className={`text-muted-foreground ${NAME_LINK}`}>
              {where}<span className="sr-only"> (ver o chaveamento)</span>
            </Link>
          ) : (
            <span className="text-muted-foreground">{where}</span>
          )}
        </p>
        {m.kind === 'bye' ? (
          <p className="text-base">Avança direto para a fase seguinte, sem jogar.</p>
        ) : m.kind === 'rest' ? (
          <p className="text-base">Folga nesta rodada: conta como vitória.</p>
        ) : m.opponentKnown ? (
          <p className="break-words text-xl font-semibold leading-tight">
            <span className="text-muted-foreground">× </span>
            {m.opponentPlayers.length === 1 && athleteId ? (
              <Link href={`/a/${athleteId}/vs/${m.opponentPlayers[0]!.id}`} className={NAME_LINK}>
                {m.opponentPlayers[0]!.name}<span className="sr-only"> (confronto direto)</span>
              </Link>
            ) : m.opponentPlayers.length > 0 ? (
              <PlayerLinks players={m.opponentPlayers} />
            ) : (
              m.opponent
            )}
          </p>
        ) : m.pending && m.pending.sides.some((s) => s.length) ? (
          <p className="break-words text-base">
            Contra o {m.pending.via} {m.pending.sides.length === 2 ? 'de ' : 'do jogo de '}
            <PlayerLinks players={m.pending.sides[0]!} />
            {m.pending.sides[1] && <> × <PlayerLinks players={m.pending.sides[1]} /></>}
          </p>
        ) : m.opponent ? (
          <p className="break-words text-base">Contra o {m.opponent}</p>
        ) : (
          <p className="text-base text-muted-foreground">Adversário a definir</p>
        )}
      </div>

      {side && (
        <div className="space-y-3 border-t border-border pt-3 sm:col-start-2 lg:col-start-auto lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          {m.score && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{m.kind === 'live' ? 'Placar agora' : 'Placar'}</p>
              <p className="font-heading text-3xl font-bold leading-none tabular-nums">{m.score}</p>
            </div>
          )}
          {m.ifWin && (
            <div className="space-y-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-muted-foreground">Se vencer<span className="sr-only">{': '}</span></span>
                <ArrowRight className="size-4 self-center text-primary" aria-hidden="true" />
                {tournamentSlug ? (
                  // A fase leva ao chaveamento da categoria (/t/[slug]?categoria=), onde se vê o caminho até ela.
                  <Link
                    href={`/t/${tournamentSlug}?categoria=${m.categoryId}`}
                    className="font-heading text-xl font-bold leading-tight text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                  >
                    {m.ifWin.roundLabel}<span className="sr-only"> (ver o chaveamento de {m.categoryName})</span>
                  </Link>
                ) : (
                  <span className="font-heading text-xl font-bold leading-tight">{m.ifWin.roundLabel}</span>
                )}
              </p>
              <p className="break-words text-sm text-muted-foreground">{m.ifWin.opponent ? `contra ${m.ifWin.opponent}` : 'adversário a definir'}</p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
