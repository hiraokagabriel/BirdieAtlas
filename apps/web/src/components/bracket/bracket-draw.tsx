'use client'

import { Trophy } from 'lucide-react'

type Match = {
  id: string
  round: number
  position: number
  status: string
  registration1Id: string | null
  registration2Id: string | null
}

type Registration = {
  id: string
  athleteId: string
  athlete2Id: string | null
  seed: number | null
}

type Athlete = {
  id: string
  name: string
}

type MatchResult = {
  matchId: string
  setNumber: number
  score1: number
  score2: number
}

type Category = {
  id: string
  name: string
  discipline: string
}

type Props = {
  matches: Match[]
  registrations: Registration[]
  athletes: Athlete[]
  results: MatchResult[]
  activeCategory?: Category
}

const disciplineBorder: Record<string, string> = {
  MS: 'border-blue-400',
  WS: 'border-purple-400',
  MD: 'border-cyan-400',
  WD: 'border-pink-400',
  XD: 'border-orange-400',
}

const disciplineWinner: Record<string, string> = {
  MS: 'bg-blue-50 border-blue-300 text-blue-900',
  WS: 'bg-purple-50 border-purple-300 text-purple-900',
  MD: 'bg-cyan-50 border-cyan-300 text-cyan-900',
  WD: 'bg-pink-50 border-pink-300 text-pink-900',
  XD: 'bg-orange-50 border-orange-300 text-orange-900',
}

function getAthleteLabel(regId: string | null, registrations: Registration[], athletes: Athlete[]): { name: string; seed: number | null } {
  if (!regId) return { name: 'BYE', seed: null }
  const reg = registrations.find((r) => r.id === regId)
  if (!reg) return { name: '?', seed: null }
  const a1 = athletes.find((a) => a.id === reg.athleteId)
  const a2 = reg.athlete2Id ? athletes.find((a) => a.id === reg.athlete2Id) : null
  const name = a2 ? `${a1?.name ?? '?'} / ${a2.name}` : (a1?.name ?? '?')
  return { name, seed: reg.seed }
}

function getMatchWinner(match: Match, results: MatchResult[]): 1 | 2 | null {
  if (match.status !== 'completed' && match.status !== 'walkover') return null
  const sets = results.filter((r) => r.matchId === match.id)
  if (!sets.length) return null
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : 2
}

function getMatchScore(match: Match, results: MatchResult[]): string {
  const sets = results
    .filter((r) => r.matchId === match.id)
    .sort((a, b) => a.setNumber - b.setNumber)
  if (!sets.length) return ''
  return sets.map((s) => `${s.score1}-${s.score2}`).join(', ')
}

const statusLabel: Record<string, { label: string; dot: string }> = {
  pending: { label: 'Aguardando', dot: 'bg-gray-300' },
  in_progress: { label: 'Ao vivo', dot: 'bg-green-500 animate-pulse' },
  completed: { label: 'Encerrada', dot: 'bg-blue-400' },
  walkover: { label: 'W.O.', dot: 'bg-yellow-400' },
  retired: { label: 'Ret.', dot: 'bg-red-400' },
}

export function BracketDraw({ matches, registrations, athletes, results, activeCategory }: Props) {
  const maxRound = Math.max(...matches.map((m) => m.round))
  const rounds = Array.from({ length: maxRound }, (_, i) => maxRound - i) // ordem: round maior (1a fase) primeiro
  const borderColor = disciplineBorder[activeCategory?.discipline ?? ''] ?? 'border-gray-300'
  const winnerColor = disciplineWinner[activeCategory?.discipline ?? ''] ?? 'bg-gray-50 border-gray-300'

  return (
    <div className="p-6 overflow-x-auto">
      <div className="flex gap-0 min-w-max">
        {rounds.map((round, roundIdx) => {
          const roundMatches = matches
            .filter((m) => m.round === round)
            .sort((a, b) => a.position - b.position)

          const roundLabel =
            round === 1 ? 'Final'
            : round === 2 ? 'Semifinal'
            : round === 3 ? 'Quartas de Final'
            : `Fase ${round}`

          const isLastRound = roundIdx === rounds.length - 1

          return (
            <div key={round} className="flex flex-col" style={{ minWidth: 220 }}>
              {/* Round header */}
              <div className="text-center pb-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {roundLabel}
                </span>
              </div>

              {/* Matches column */}
              <div className="flex flex-col flex-1 justify-around gap-2 pr-0">
                {roundMatches.map((match) => {
                  const p1 = getAthleteLabel(match.registration1Id, registrations, athletes)
                  const p2 = getAthleteLabel(match.registration2Id, registrations, athletes)
                  const winner = getMatchWinner(match, results)
                  const score = getMatchScore(match, results)
                  const status = statusLabel[match.status] ?? statusLabel.pending
                  const isFinal = round === 1

                  return (
                    <div key={match.id} className="flex items-center">
                      <div className={`flex-1 rounded-lg border-2 overflow-hidden ${
                        isFinal ? `${borderColor} shadow-sm` : 'border-border'
                      }`}>
                        {/* Player 1 */}
                        <div className={`flex items-center gap-2 px-3 py-2 border-b border-border ${
                          winner === 1 ? winnerColor : winner === 2 ? 'opacity-40' : ''
                        }`}>
                          {p1.seed && (
                            <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">[{p1.seed}]</span>
                          )}
                          <span className={`text-sm flex-1 truncate ${
                            winner === 1 ? 'font-semibold' : 'font-medium'
                          }`}>{p1.name}</span>
                          {winner === 1 && <Trophy className="w-3 h-3 shrink-0" />}
                        </div>

                        {/* Player 2 */}
                        <div className={`flex items-center gap-2 px-3 py-2 ${
                          winner === 2 ? winnerColor : winner === 1 ? 'opacity-40' : ''
                        }`}>
                          {p2.seed && (
                            <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">[{p2.seed}]</span>
                          )}
                          <span className={`text-sm flex-1 truncate ${
                            winner === 2 ? 'font-semibold' : 'font-medium'
                          }`}>{p2.name}</span>
                          {winner === 2 && <Trophy className="w-3 h-3 shrink-0" />}
                        </div>

                        {/* Score + status footer */}
                        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-t border-border">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            <span className="text-xs text-muted-foreground">{status.label}</span>
                          </div>
                          {score && <span className="text-xs font-mono text-muted-foreground">{score}</span>}
                        </div>
                      </div>

                      {/* Connector line to next round */}
                      {!isLastRound && (
                        <div className="w-8 flex items-center">
                          <div className="w-full h-px bg-border" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Champion placeholder after final */}
        {matches.some((m) => m.round === 1 && (m.status === 'completed' || m.status === 'walkover')) && (() => {
          const finalMatch = matches.find((m) => m.round === 1)
          if (!finalMatch) return null
          const winner = getMatchWinner(finalMatch, results)
          if (!winner) return null
          const champ = getAthleteLabel(
            winner === 1 ? finalMatch.registration1Id : finalMatch.registration2Id,
            registrations,
            athletes
          )
          return (
            <div className="flex flex-col" style={{ minWidth: 180 }}>
              <div className="text-center pb-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campeão</span>
              </div>
              <div className="flex flex-col flex-1 justify-around">
                <div className="flex items-center gap-2">
                  <div className="w-8 flex items-center"><div className="w-full h-px bg-border" /></div>
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 ${disciplineBorder[activeCategory?.discipline ?? '']} ${disciplineWinner[activeCategory?.discipline ?? '']} shadow-md`}>
                    <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                    <span className="text-sm font-bold">{champ.name}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
