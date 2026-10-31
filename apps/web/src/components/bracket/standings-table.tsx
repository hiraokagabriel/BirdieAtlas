import { cn } from '@/lib/utils'

export type StandingRow = {
  position: number
  registrationId: string
  played: number
  wins: number
  losses: number
  setsFor: number
  setsAgainst: number
  pointsFor: number
  pointsAgainst: number
  /** Só no suíço. */
  buchholz?: number
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

/** Classificação de um todos contra todos ou de um grupo. */
export function StandingsTable({
  rows,
  nameOf,
  label,
  highlightTop = 0,
}: {
  rows: readonly StandingRow[]
  nameOf: (registrationId: string) => string
  /** Nome acessível da região (ex.: "Classificação do Grupo A"). */
  label: string
  /** Quantas primeiras posições destacar (classificados do grupo). */
  highlightTop?: number
}) {
  const showBuchholz = rows.some((r) => r.buchholz !== undefined)
  return (
    <div tabIndex={0} role="region" aria-label={label} className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">
          {label}: posição, participante, jogos, vitórias, derrotas e saldos de sets e de pontos.
        </caption>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-left">Pos.</th>
            <th scope="col" className="px-3 py-2 text-left">Participante</th>
            <th scope="col" className="px-3 py-2 text-right">J</th>
            <th scope="col" className="px-3 py-2 text-right">V</th>
            <th scope="col" className="px-3 py-2 text-right">D</th>
            {showBuchholz && <th scope="col" className="px-3 py-2 text-right">Buchholz</th>}
            <th scope="col" className="px-3 py-2 text-right">Sets</th>
            <th scope="col" className="px-3 py-2 text-right">Pontos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.registrationId} className={cn(row.position <= highlightTop && 'bg-success/5')}>
              <th scope="row" className="px-3 py-2 text-left font-semibold tabular-nums">
                {row.position}º
                {row.position <= highlightTop && <span className="sr-only"> (classificado)</span>}
              </th>
              <td className="px-3 py-2">{nameOf(row.registrationId)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.played}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.wins}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.losses}</td>
              {showBuchholz && <td className="px-3 py-2 text-right tabular-nums">{row.buchholz ?? 0}</td>}
              <td className="px-3 py-2 text-right tabular-nums">{signed(row.setsFor - row.setsAgainst)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{signed(row.pointsFor - row.pointsAgainst)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
