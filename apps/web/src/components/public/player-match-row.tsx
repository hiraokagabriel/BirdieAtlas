import { formatTvTime } from '@/lib/live'
import { Badge } from '@/components/ui/badge'

// Linha de partida do jogador ("Encontre sua próxima partida"): usada na página do jogador no torneio e no perfil.

// Mesmo fuso das súmulas: o servidor pode rodar em UTC.
const TIME_ZONE = 'America/Sao_Paulo'

export type PlayerMatch = {
  matchId: string
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

/** `highlight`: a próxima partida dele, marcada com fundo e o rótulo "Próxima" (no perfil, onde as partidas a jogar ficam juntas). */
export function MatchRow({ match: m, showCategory = false, highlight = false }: { match: PlayerMatch; showCategory?: boolean; highlight?: boolean }) {
  const time = formatTvTime(m.scheduledAt, new Date(), TIME_ZONE)
  return (
    <li className={highlight ? 'space-y-1 bg-secondary px-4 py-3' : 'space-y-1 px-4 py-3'}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {highlight && m.kind !== 'live' && <span className="text-xs font-semibold text-primary">Próxima</span>}
        <StatusChip match={m} />
        <span className="text-sm font-semibold">{showCategory ? `${m.categoryName} · ${m.roundLabel}` : m.roundLabel}</span>
        {m.courtNumber != null && <span className="font-heading text-base font-bold">Quadra {m.courtNumber}</span>}
        {time && <span className="text-sm tabular-nums text-muted-foreground">{time}</span>}
      </div>
      {m.kind === 'bye' ? (
        <p>Avança direto para a fase seguinte, sem jogar.</p>
      ) : m.kind === 'rest' ? (
        <p>Folga nesta rodada: conta como vitória.</p>
      ) : (
        <p className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="min-w-0 break-words">
            {m.opponentKnown ? (
              <>
                <span className="font-semibold text-muted-foreground">× </span>
                <span className="font-medium">{m.opponent}</span>
              </>
            ) : m.opponent ? (
              <span>Contra o {m.opponent}</span>
            ) : (
              <span className="text-muted-foreground">Adversário a definir</span>
            )}
          </span>
          {m.score && <span className="font-heading text-lg font-bold tabular-nums">{m.score}</span>}
        </p>
      )}
      {m.ifWin && (
        <p className="text-sm text-muted-foreground">
          Se vencer: {m.ifWin.roundLabel}{m.ifWin.opponent ? ` contra ${m.ifWin.opponent}` : ', adversário a definir'}
        </p>
      )}
    </li>
  )
}
