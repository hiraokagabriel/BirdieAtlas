import Link from 'next/link'
import { Check, Pencil, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  describeSlot,
  effectiveWinner,
  formatMatchTime,
  isByeMatch,
  matchAriaLabel,
  statusChip,
  type BracketEntry,
  type BracketMatch,
  type SetScore,
  type SlotView,
  type StatusChip,
} from '@/lib/bracket'
import { formatLiveScore, type LiveMatch } from '@/lib/live'

const CHIP_STYLES: Record<StatusChip['key'], string> = {
  scheduled: 'text-info',
  waiting: 'text-muted-foreground',
  live: 'text-success',
  done: 'text-foreground',
  walkover: 'text-warning',
  retired: 'text-destructive',
  bye: 'text-muted-foreground',
}

const DOT_STYLES: Record<StatusChip['key'], string> = {
  scheduled: 'bg-info',
  waiting: 'bg-muted-foreground/50',
  live: 'bg-success motion-safe:animate-pulse',
  done: 'bg-foreground/60',
  walkover: 'bg-warning',
  retired: 'bg-destructive',
  bye: 'bg-muted-foreground/50',
}

export type MatchCardProps = {
  match: BracketMatch
  title: string
  maxRound: number
  entries: ReadonlyMap<string, BracketEntry>
  sets: readonly SetScore[]
  /** Admin: abre o diálogo de resultado. Sem ele o cartão é só leitura. */
  onSelect?: (match: BracketMatch) => void
  /** Público: nomes de atletas viram links para o perfil. */
  linkAthletes?: boolean
  /** Placar ao vivo da partida (provisório): mostra o set em andamento no lugar dos sets salvos. */
  live?: LiveMatch
}

function ParticipantName({ slot, link }: { slot: SlotView; link: boolean }) {
  if (slot.kind === 'bye') return <span className="truncate text-sm italic">BYE</span>
  if (slot.kind === 'tbd') return <span className="truncate text-sm italic">A definir</span>
  return (
    <span className="min-w-0 truncate text-sm">
      {slot.athletes.map((athlete, index) => (
        <span key={`${athlete.id}-${index}`}>
          {index > 0 && ' / '}
          {link && athlete.id ? (
            <Link
              href={`/a/${athlete.id}`}
              className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {athlete.name}
            </Link>
          ) : (
            athlete.name
          )}
        </span>
      ))}
    </span>
  )
}

function SlotRow({
  slot,
  state,
  scores,
  isFinal,
  link,
}: {
  slot: SlotView
  state: 'winner' | 'loser' | 'open'
  scores: { own: number; other: number; current?: boolean }[]
  isFinal: boolean
  link: boolean
}) {
  const placeholder = slot.kind !== 'athlete'
  return (
    <span
      className={cn(
        'flex h-10 items-center gap-2 border-l-[3px] px-2.5',
        state === 'winner' ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'border-transparent',
        state === 'loser' && 'text-muted-foreground',
        state === 'open' && !placeholder && 'text-foreground',
        placeholder && 'bg-muted/50 text-muted-foreground',
      )}
    >
      {slot.kind === 'athlete' && slot.seed != null && (
        <span className="shrink-0 rounded bg-muted px-1 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
          <span className="sr-only">Cabeça de chave </span>
          {slot.seed}
        </span>
      )}
      <ParticipantName slot={slot} link={link} />
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {scores.map((score, index) => (
          <span
            key={index}
            className={cn(
              'w-5 text-center text-sm tabular-nums',
              score.current
                ? 'w-7 rounded bg-success/10 font-bold text-success'
                : score.own > score.other
                  ? 'font-bold'
                  : 'font-normal text-muted-foreground',
            )}
          >
            {score.own}
          </span>
        ))}
        {state === 'winner' &&
          (isFinal ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-medal-gold text-medal-gold-foreground">
              <Trophy className="size-3" aria-hidden="true" />
              <span className="sr-only">Campeão</span>
            </span>
          ) : (
            <Check className="size-4 text-primary" aria-hidden="true" />
          ))}
      </span>
    </span>
  )
}

export function MatchCard({ match, title, maxRound, entries, sets, onSelect, linkAthletes = false, live }: MatchCardProps) {
  const bye = isByeMatch(match, maxRound)
  const slot1 = describeSlot(match.registration1Id, entries, bye)
  const slot2 = describeSlot(match.registration2Id, entries, bye)
  const winner = effectiveWinner(match, sets, bye)
  const chip = statusChip(match, bye)
  const when = formatMatchTime(match.scheduledAt)
  const court = match.courtNumber != null ? `Quadra ${match.courtNumber}` : null
  const info = [court, when].filter(Boolean).join(' · ')
  const baseLabel = matchAriaLabel(title, match.position, slot1, slot2, winner, bye)
  const liveScore = live ? formatLiveScore(live) : ''
  const label = live ? `${baseLabel}, ao vivo${liveScore ? `, placar ${liveScore}` : ''}` : baseLabel
  const actionable = !!onSelect && !bye && slot1.kind === 'athlete' && slot2.kind === 'athlete'
  const isFinal = match.round === 1

  // Ao vivo: sets encerrados do placar provisório e, por último, o set em disputa.
  const rows = live
    ? [
        ...live.sets.map((s) => ({ s1: s.score1, s2: s.score2, current: false })),
        ...(live.currentSet ? [{ s1: live.currentSet.score1, s2: live.currentSet.score2, current: true }] : []),
      ]
    : sets.map((s) => ({ s1: s.score1, s2: s.score2, current: false }))
  const stateOf = (side: 1 | 2): 'winner' | 'loser' | 'open' =>
    winner === null ? 'open' : winner === side ? 'winner' : 'loser'

  const body = (
    <>
      <SlotRow
        slot={slot1}
        state={stateOf(1)}
        scores={rows.map((r) => ({ own: r.s1, other: r.s2, current: r.current }))}
        isFinal={isFinal}
        link={linkAthletes}
      />
      <span className="block border-t border-border" />
      <SlotRow
        slot={slot2}
        state={stateOf(2)}
        scores={rows.map((r) => ({ own: r.s2, other: r.s1, current: r.current }))}
        isFinal={isFinal}
        link={linkAthletes}
      />
      <span className="flex h-7 items-center justify-between gap-2 border-t border-border bg-muted/40 px-2.5 text-xs">
        <span className={cn('flex items-center gap-1.5 font-medium', CHIP_STYLES[chip.key])}>
          <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT_STYLES[chip.key])} />
          {chip.label}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          {info && <span className="truncate tabular-nums">{info}</span>}
          {actionable && <Pencil className="size-3 shrink-0" aria-hidden="true" />}
        </span>
      </span>
    </>
  )

  const frame = cn(
    'block w-full overflow-hidden rounded-lg border bg-card text-left shadow-sm',
    bye ? 'border-dashed border-border bg-muted/20' : 'border-border',
    isFinal && winner !== null && 'border-medal-gold shadow-md',
  )

  if (actionable && onSelect) {
    return (
      <button
        type="button"
        aria-label={`${label}. Abrir resultado`}
        onClick={() => onSelect(match)}
        className={cn(
          frame,
          'cursor-pointer transition-shadow hover:border-primary/50 hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
        )}
      >
        {body}
      </button>
    )
  }

  return (
    <div role="group" aria-label={label} className={frame}>
      {body}
    </div>
  )
}
