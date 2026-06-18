'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Trophy, Loader2, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type GameScore = { score1: string; score2: string }

type MatchResult = {
  matchId: string
  setNumber: number
  score1: number
  score2: number
}

type Match = {
  id: string
  round: number
  status: string
  registration1Id: string | null
  registration2Id: string | null
}

type Props = {
  match: Match | null
  open: boolean
  onClose: () => void
  player1Name: string
  player2Name: string
  drawId: string
  categoryId: string
  existingResults?: MatchResult[]
}

function getGameWinner(game: GameScore): 1 | 2 | null {
  const s1 = parseInt(game.score1)
  const s2 = parseInt(game.score2)
  if (isNaN(s1) || isNaN(s2) || s1 === s2) return null
  return s1 > s2 ? 1 : 2
}

function inferMatchWinner(games: GameScore[]): 1 | 2 | null {
  const wins1 = games.filter((g) => getGameWinner(g) === 1).length
  const wins2 = games.filter((g) => getGameWinner(g) === 2).length
  if (wins1 > wins2) return 1
  if (wins2 > wins1) return 2
  return null
}

/** Valida as regras de games do badminton:
 * - Mínimo 2 games preenchidos
 * - Se game 2 definir vencedor da partida (um jogador vence 2 a 0), 3º game não deve existir ou está vazio
 * - 3º game só é válido se os 2 primeiros terminaram 1x1
 * - Retorna null se válido, ou uma string de erro
 */
function validateGames(games: GameScore[], resultType: 'completed' | 'walkover' | 'retired'): string | null {
  if (resultType !== 'completed') return null

  const filled = games.filter((g) => g.score1 !== '' && g.score2 !== '')

  if (filled.length < 2) return 'Preencha ao menos 2 games.'

  const g1 = getGameWinner(games[0])
  const g2 = getGameWinner(games[1])

  if (!g1) return 'Game 1 não tem vencedor definido (placar empatado ou inválido).'
  if (!g2) return 'Game 2 não tem vencedor definido (placar empatado ou inválido).'

  if (g1 === g2) {
    // Partida decidida em 2 games — 3º game não deve ser preenchido
    if (games[2] && (games[2].score1 !== '' || games[2].score2 !== '')) {
      return '3º game não é necessário: o vencedor já foi definido nos 2 primeiros games.'
    }
  } else {
    // Empate 1x1 — 3º game obrigatório
    if (!games[2] || games[2].score1 === '' || games[2].score2 === '') {
      return '3º game obrigatório: os 2 primeiros games terminaram empatados (1x1).'
    }
    const g3 = getGameWinner(games[2])
    if (!g3) return '3º game não tem vencedor definido.'
  }

  return null
}

export function MatchResultDialog({
  match, open, onClose, player1Name, player2Name, drawId, categoryId: _categoryId, existingResults,
}: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!existingResults?.length

  const [games, setGames] = useState<GameScore[]>([
    { score1: '', score2: '' },
    { score1: '', score2: '' },
  ])
  const [resultType, setResultType] = useState<'completed' | 'walkover' | 'retired'>('completed')
  const [submitAttempted, setSubmitAttempted] = useState(false)

  useEffect(() => {
    if (open && isEdit && existingResults) {
      const sorted = [...existingResults].sort((a, b) => a.setNumber - b.setNumber)
      const loaded = sorted.map((s) => ({ score1: String(s.score1), score2: String(s.score2) }))
      // Garante mínimo 2 games
      while (loaded.length < 2) loaded.push({ score1: '', score2: '' })
      setGames(loaded)
      if (match?.status) setResultType(match.status as 'completed' | 'walkover' | 'retired')
    } else if (open && !isEdit) {
      setGames([{ score1: '', score2: '' }, { score1: '', score2: '' }])
      setResultType('completed')
    }
    setSubmitAttempted(false)
  }, [open, isEdit])

  function handleResultTypeChange(type: 'completed' | 'walkover' | 'retired') {
    setResultType(type)
    if (type !== 'completed') {
      setGames([{ score1: '', score2: '' }, { score1: '', score2: '' }])
    }
    setSubmitAttempted(false)
  }

  const winner = inferMatchWinner(games)
  const gameValidationError = validateGames(games, resultType)

  // Para WO e Ret.: exige vencedor identificável
  const isSpecialModeValid = resultType === 'completed' ? !gameValidationError : winner !== null

  const { mutate: submitResult, isPending } = useMutation({
    mutationFn: async () => {
      const validGames = games
        .map((g, i) => ({ setNumber: i + 1, score1: parseInt(g.score1), score2: parseInt(g.score2) }))
        .filter((g) => !isNaN(g.score1) && !isNaN(g.score2))

      if (!validGames.length) throw new Error('Nenhum game válido para enviar')

      const res = await fetch(`${API_URL}/draws/matches/${match!.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets: validGames, status: resultType }),
      })
      if (!res.ok) throw new Error('Erro ao salvar resultado')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', drawId] })
      queryClient.invalidateQueries({ queryKey: ['results', drawId] })
      handleClose()
    },
  })

  function handleClose() {
    setGames([{ score1: '', score2: '' }, { score1: '', score2: '' }])
    setResultType('completed')
    setSubmitAttempted(false)
    onClose()
  }

  function handleSubmit() {
    setSubmitAttempted(true)
    if (!isSpecialModeValid) return
    submitResult()
  }

  // Lógica de games: sempre 2 games fixos. 3º game aparece se games 1 e 2 estiverem 1x1
  const g1Winner = getGameWinner(games[0])
  const g2Winner = getGameWinner(games[1])
  const showThirdGame = g1Winner !== null && g2Winner !== null && g1Winner !== g2Winner

  function updateGame(idx: number, field: 'score1' | 'score2', value: string) {
    setGames((prev) => {
      const updated = prev.map((g, i) => i === idx ? { ...g, [field]: value } : g)
      // Se 3º game não é mais necessário, limpa-o
      const w1 = getGameWinner(updated[0])
      const w2 = getGameWinner(updated[1])
      const needsThird = w1 !== null && w2 !== null && w1 !== w2
      if (!needsThird && updated[2]) {
        return [
          updated[0],
          updated[1],
          { score1: '', score2: '' },
        ]
      }
      return updated
    })
  }

  // Garante que o array tem slot para o 3º game
  const displayGames: GameScore[] = [
    games[0] ?? { score1: '', score2: '' },
    games[1] ?? { score1: '', score2: '' },
    games[2] ?? { score1: '', score2: '' },
  ]

  const roundLabel = match?.round === 1 ? 'Final'
    : match?.round === 2 ? 'Semifinal'
    : match?.round === 3 ? 'Quartas de Final'
    : `Fase ${match?.round}`

  const showValidationError = submitAttempted && !isSpecialModeValid

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Resultado' : 'Lançar Resultado'}</DialogTitle>
          <p className="text-sm text-muted-foreground">{roundLabel}</p>
        </DialogHeader>

        {isEdit && (
          <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <span>⚠️</span>
            <span>Se o vencedor mudar, as partidas seguintes serão reabertas automaticamente.</span>
          </div>
        )}

        {/* Players */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className={`flex items-center gap-3 px-4 py-3 border-b border-border ${
            winner === 1 ? 'bg-green-50' : 'bg-muted/30'
          }`}>
            {winner === 1 && <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />}
            <span className={`text-sm flex-1 truncate ${
              winner === 1 ? 'font-semibold' : winner === 2 ? 'text-muted-foreground' : 'font-medium'
            }`}>{player1Name}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {displayGames.filter((g) => getGameWinner(g) === 1).length} games
            </span>
          </div>
          <div className={`flex items-center gap-3 px-4 py-3 ${
            winner === 2 ? 'bg-green-50' : ''
          }`}>
            {winner === 2 && <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />}
            <span className={`text-sm flex-1 truncate ${
              winner === 2 ? 'font-semibold' : winner === 1 ? 'text-muted-foreground' : 'font-medium'
            }`}>{player2Name}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {displayGames.filter((g) => getGameWinner(g) === 2).length} games
            </span>
          </div>
        </div>

        {/* Result type tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {(['completed', 'walkover', 'retired'] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleResultTypeChange(type)}
              className={`flex-1 py-1 rounded-md text-xs font-semibold transition-all ${
                resultType === type
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type === 'completed' ? 'Normal' : type === 'walkover' ? 'W.O.' : 'Ret.'}
            </button>
          ))}
        </div>

        {/* Games — modo Normal */}
        {resultType === 'completed' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parciais</p>
              <p className="text-xs text-muted-foreground">
                {showThirdGame ? '3 games (1x1 — decidindo)' : '2 games'}
              </p>
            </div>
            <div className="grid grid-cols-[1fr_40px_1fr_8px] gap-2 px-1">
              <p className="text-xs text-muted-foreground truncate">{player1Name.split(' ')[0]}</p>
              <div />
              <p className="text-xs text-muted-foreground truncate">{player2Name.split(' ')[0]}</p>
              <div />
            </div>
            {[0, 1, ...(showThirdGame ? [2] : [])].map((idx) => {
              const game = displayGames[idx]
              const gw = getGameWinner(game)
              const isThird = idx === 2
              return (
                <div key={idx} className={`grid grid-cols-[1fr_40px_1fr_8px] gap-2 items-center ${
                  isThird ? 'pt-1 border-t border-dashed border-border' : ''
                }`}>
                  <Input
                    type="number" min={0} max={30} placeholder="0"
                    value={game.score1}
                    onChange={(e) => updateGame(idx, 'score1', e.target.value)}
                    className={`text-center font-mono ${
                      gw === 1 ? 'border-green-400 bg-green-50 font-bold' : ''
                    }`}
                  />
                  <p className="text-center text-xs text-muted-foreground font-medium">
                    {isThird ? 'G3 🏸' : `G${idx + 1}`}
                  </p>
                  <Input
                    type="number" min={0} max={30} placeholder="0"
                    value={game.score2}
                    onChange={(e) => updateGame(idx, 'score2', e.target.value)}
                    className={`text-center font-mono ${
                      gw === 2 ? 'border-green-400 bg-green-50 font-bold' : ''
                    }`}
                  />
                  <div />
                </div>
              )
            })}
          </div>
        )}

        {/* Seleção de vencedor — W.O. e Ret. */}
        {resultType !== 'completed' && (
          <div className="space-y-3">
            <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${
              resultType === 'walkover'
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {resultType === 'walkover'
                  ? 'W.O.: selecione quem avança. O placar será registrado como 21–0 para o vencedor.'
                  : 'Ret.: selecione quem estava vencendo quando a partida foi interrompida.'}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quem avança?</p>
              <div className="grid grid-cols-2 gap-2">
                {[player1Name, player2Name].map((name, idx) => (
                  <button
                    key={idx}
                    onClick={() => setGames([
                      idx === 0 ? { score1: '21', score2: '0' } : { score1: '0', score2: '21' },
                      idx === 0 ? { score1: '21', score2: '0' } : { score1: '0', score2: '21' },
                    ])}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      (idx === 0 && winner === 1) || (idx === 1 && winner === 2)
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {showValidationError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Selecione o vencedor antes de confirmar.
              </p>
            )}
          </div>
        )}

        {/* Erro de validação — modo Normal */}
        {resultType === 'completed' && showValidationError && gameValidationError && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {gameValidationError}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              : isEdit ? 'Salvar alterações' : 'Confirmar resultado'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
