'use client'

import { useState } from 'react'
import { Trophy, Pencil } from 'lucide-react'
import { MatchResultDialog } from './match-result-dialog'

type Match = {
  id: string; round: number; position: number; status: string
  registration1Id: string | null; registration2Id: string | null
  nextMatchId: string | null
}

type Registration = { id: string; athleteId: string; athlete2Id: string | null; seed: number | null }
type Athlete = { id: string; name: string }
type MatchResult = { matchId: string; setNumber: number; score1: number; score2: number }
type Category = { id: string; name: string; discipline: string }

type Props = {
  matches: Match[]
  registrations: Registration[]
  athletes: Athlete[]
  results: MatchResult[]
  activeCategory?: Category
  drawId: string
  readonly?: boolean
}

const disciplineBorder: Record<string, string> = {
  MS: 'border-blue-400', WS: 'border-purple-400', MD: 'border-cyan-400',
  WD: 'border-pink-400', XD: 'border-orange-400',
}

const disciplineWinner: Record<string, string> = {
  MS: 'bg-blue-50 border-blue-300 text-blue-900', WS: 'bg-purple-50 border-purple-300 text-purple-900',
  MD: 'bg-cyan-50 border-cyan-300 text-cyan-900', WD: 'bg-pink-50 border-pink-300 text-pink-900',
  XD: 'bg-orange-50 border-orange-300 text-orange-900',
}

/**
 * Resolve o label de um slot de partida.
 *
 * Regras:
 * - Se regId existe → nome do atleta/dupla
 * - Se regId é null e a partida é de 1ª fase (maxRound) com status walkover → "BYE"
 *   (o atleta presente avançou automaticamente por falta de oponente)
 * - Se regId é null em qualquer outro caso → "Aguardando"
 *   (o vencedor de uma fase anterior ainda não chegou)
 */
function getAthleteLabel(
  regId: string | null,
  registrations: Registration[],
  athletes: Athlete[],
  isBye: boolean,
): { name: string; seed: number | null; isEmpty: boolean } {
  if (!regId) {
    return isBye
      ? { name: 'BYE', seed: null, isEmpty: true }
      : { name: 'Aguardando', seed: null, isEmpty: true }
  }
  const reg = registrations.find((r) => r.id === regId)
  if (!reg) return { name: '?', seed: null, isEmpty: false }
  const a1 = athletes.find((a) => a.id === reg.athleteId)
  const a2 = reg.athlete2Id ? athletes.find((a) => a.id === reg.athlete2Id) : null
  return {
    name: a2 ? `${a1?.name ?? '?'} / ${a2.name}` : (a1?.name ?? '?'),
    seed: reg.seed,
    isEmpty: false,
  }
}

function getMatchWinner(match: Match, results: MatchResult[]): 1 | 2 | null {
  if (!['completed', 'walkover', 'retired'].includes(match.status)) return null
  const sets = results.filter((r) => r.matchId === match.id)
  if (!sets.length) return null
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : 2
}

function getMatchScore(match: Match, results: MatchResult[]): string {
  return results
    .filter((r) => r.matchId === match.id)
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((s) => `${s.score1}-${s.score2}`)
    .join(', ')
}

const statusLabel: Record<string, { label: string; dot: string }> = {
  pending:     { label: 'Aguardando', dot: 'bg-gray-300' },
  in_progress: { label: 'Ao vivo',    dot: 'bg-green-500 animate-pulse' },
  completed:   { label: 'Encerrada',  dot: 'bg-blue-400' },
  walkover:    { label: 'W.O.',       dot: 'bg-yellow-400' },
  retired:     { label: 'Ret.',       dot: 'bg-red-400' },
}

export function BracketDraw({ matches, registrations, athletes, results, activeCategory, drawId, readonly = false }: Props) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)

  const maxRound = Math.max(...matches.map((m) => m.round))
  const rounds = Array.from({ length: maxRound }, (_, i) => maxRound - i)
  const borderColor = disciplineBorder[activeCategory?.discipline ?? ''] ?? 'border-gray-300'
  const winnerColor = disciplineWinner[activeCategory?.discipline ?? ''] ?? 'bg-gray-50 border-gray-300'

  const p1Selected = selectedMatch
    ? getAthleteLabel(selectedMatch.registration1Id, registrations, athletes, false)
    : { name: '', seed: null, isEmpty: false }
  const p2Selected = selectedMatch
    ? getAthleteLabel(selectedMatch.registration2Id, registrations, athletes, false)
    : { name: '', seed: null, isEmpty: false }
  const existingResults = selectedMatch ? results.filter((r) => r.matchId === selectedMatch.id) : []

  return (
    <>
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
            // Primeira fase real = round com o número mais alto
            const isFirstRound = round === maxRound

            return (
              <div key={round} className="flex flex-col" style={{ minWidth: 240 }}>
                <div className="text-center pb-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {roundLabel}
                  </span>
                </div>
                <div className="flex flex-col flex-1 justify-around gap-2">
                  {roundMatches.map((match) => {
                    // Um slot é BYE real somente na 1ª fase com status walkover
                    const isRealBye = isFirstRound && match.status === 'walkover'
                    const p1 = getAthleteLabel(match.registration1Id, registrations, athletes, isRealBye && match.registration1Id === null)
                    const p2 = getAthleteLabel(match.registration2Id, registrations, athletes, isRealBye && match.registration2Id === null)

                    const winner = getMatchWinner(match, results)
                    const score  = getMatchScore(match, results)
                    const status = statusLabel[match.status] ?? statusLabel.pending
                    const isFinal = round === 1

                    // Partida interagível: ambos os slots têm atleta real
                    const canInteract = !readonly
                      && !p1.isEmpty
                      && !p2.isEmpty
                      && (match.status === 'pending' || match.status === 'in_progress' || ['completed', 'walkover', 'retired'].includes(match.status))

                    // Partida BYE (1ª fase walkover) — exibe compacto, sem interação
                    if (isRealBye) {
                      const advancingLabel = match.registration1Id !== null ? p1 : p2
                      return (
                        <div key={match.id} className="flex items-center">
                          <div className="flex-1 rounded-lg border border-dashed border-border bg-muted/20 overflow-hidden opacity-60">
                            <div className="flex items-center gap-2 px-3 py-2">
                              <span className="text-xs text-muted-foreground italic flex-1 truncate">
                                {advancingLabel.name} <span className="font-medium text-primary">avança (BYE)</span>
                              </span>
                            </div>
                          </div>
                          {!isLastRound && (
                            <div className="w-8 flex items-center"><div className="w-full h-px bg-border" /></div>
                          )}
                        </div>
                      )
                    }

                    return (
                      <div key={match.id} className="flex items-center">
                        <div
                          className={`flex-1 rounded-lg border-2 overflow-hidden transition-all ${
                            isFinal ? `${borderColor} shadow-sm` : 'border-border'
                          } ${canInteract ? 'cursor-pointer hover:shadow-md hover:border-primary/40' : ''}`}
                          onClick={() => canInteract && setSelectedMatch(match)}
                        >
                          {/* Slot 1 */}
                          <div className={`flex items-center gap-2 px-3 py-2 border-b border-border ${
                            p1.isEmpty ? 'bg-muted/20' :
                            winner === 1 ? winnerColor : winner === 2 ? 'opacity-40' : ''
                          }`}>
                            {p1.seed != null && (
                              <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">[{p1.seed}]</span>
                            )}
                            <span className={`text-sm flex-1 truncate ${
                              p1.isEmpty ? 'text-muted-foreground italic' :
                              winner === 1 ? 'font-semibold' : 'font-medium'
                            }`}>
                              {p1.name}
                            </span>
                            {winner === 1 && <Trophy className="w-3 h-3 shrink-0 text-yellow-500" />}
                          </div>

                          {/* Slot 2 */}
                          <div className={`flex items-center gap-2 px-3 py-2 ${
                            p2.isEmpty ? 'bg-muted/20' :
                            winner === 2 ? winnerColor : winner === 1 ? 'opacity-40' : ''
                          }`}>
                            {p2.seed != null && (
                              <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">[{p2.seed}]</span>
                            )}
                            <span className={`text-sm flex-1 truncate ${
                              p2.isEmpty ? 'text-muted-foreground italic' :
                              winner === 2 ? 'font-semibold' : 'font-medium'
                            }`}>
                              {p2.name}
                            </span>
                            {winner === 2 && <Trophy className="w-3 h-3 shrink-0 text-yellow-500" />}
                          </div>

                          {/* Status bar */}
                          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-t border-border">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                              <span className="text-xs text-muted-foreground">{status.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {score && <span className="text-xs font-mono text-muted-foreground">{score}</span>}
                              {canInteract && <Pencil className="w-3 h-3 text-muted-foreground" />}
                            </div>
                          </div>
                        </div>

                        {!isLastRound && (
                          <div className="w-8 flex items-center"><div className="w-full h-px bg-border" /></div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Campeão */}
          {matches.some((m) => m.round === 1 && ['completed', 'walkover', 'retired'].includes(m.status)) && (() => {
            const finalMatch = matches.find((m) => m.round === 1)
            if (!finalMatch) return null
            const winner = getMatchWinner(finalMatch, results)
            if (!winner) return null
            const champ = getAthleteLabel(
              winner === 1 ? finalMatch.registration1Id : finalMatch.registration2Id,
              registrations,
              athletes,
              false,
            )
            return (
              <div className="flex flex-col" style={{ minWidth: 180 }}>
                <div className="text-center pb-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campeão</span>
                </div>
                <div className="flex flex-col flex-1 justify-around">
                  <div className="flex items-center gap-2">
                    <div className="w-8 flex items-center"><div className="w-full h-px bg-border" /></div>
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 ${
                      disciplineBorder[activeCategory?.discipline ?? '']
                    } ${
                      disciplineWinner[activeCategory?.discipline ?? '']
                    } shadow-md`}>
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

      {!readonly && (
        <MatchResultDialog
          match={selectedMatch}
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          player1Name={p1Selected.name}
          player2Name={p2Selected.name}
          drawId={drawId}
          categoryId={activeCategory?.id ?? ''}
          existingResults={existingResults}
        />
      )}
    </>
  )
}
