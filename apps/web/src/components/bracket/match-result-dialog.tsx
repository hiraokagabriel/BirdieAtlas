'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ResultHistory } from './result-history'

type GameScore = { score1: string; score2: string }

const ERROR_ID = 'match-result-error'

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
  existingResults?: MatchResult[]
  roundLabel: string
}

const RESULT_TYPES = [
  { value: 'completed', label: 'Normal' },
  { value: 'walkover', label: 'W.O.' },
  { value: 'retired', label: 'Ret.' },
] as const

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

  if (filled.length < 2) return 'Preencha ao menos 2 sets.'

  const g1 = getGameWinner(games[0])
  const g2 = getGameWinner(games[1])

  if (!g1) return 'O 1º set não tem vencedor (placar empatado ou inválido).'
  if (!g2) return 'O 2º set não tem vencedor (placar empatado ou inválido).'

  if (g1 === g2) {
    // Partida decidida em 2 games — 3º game não deve ser preenchido
    if (games[2] && (games[2].score1 !== '' || games[2].score2 !== '')) {
      return 'O 3º set não é necessário: o vencedor já foi definido nos 2 primeiros sets.'
    }
  } else {
    // Empate 1x1 — 3º game obrigatório
    if (!games[2] || games[2].score1 === '' || games[2].score2 === '') {
      return 'O 3º set é obrigatório: os 2 primeiros sets terminaram 1 × 1.'
    }
    const g3 = getGameWinner(games[2])
    if (!g3) return 'O 3º set não tem vencedor.'
  }

  return null
}

export function MatchResultDialog({
  match, open, onClose, player1Name, player2Name, drawId, existingResults, roundLabel,
}: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!existingResults?.length

  const [games, setGames] = useState<GameScore[]>([
    { score1: '', score2: '' },
    { score1: '', score2: '' },
  ])
  const [resultType, setResultType] = useState<'completed' | 'walkover' | 'retired'>('completed')
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Valores mais recentes lidos pelo efeito de reset sem torná-lo dependente deles:
  // existingResults é um array novo a cada render do pai e re-disparar o efeito
  // apagaria o que o usuário já digitou.
  const latest = useRef({ existingResults, matchStatus: match?.status })
  useEffect(() => {
    latest.current = { existingResults, matchStatus: match?.status }
  })

  // Reinicia o formulário só quando o diálogo abre/fecha ou quando os resultados
  // existentes passam a existir (carregamento tardio); nunca durante a edição.
  useEffect(() => {
    const { existingResults, matchStatus } = latest.current
    if (open && isEdit && existingResults) {
      const sorted = [...existingResults].sort((a, b) => a.setNumber - b.setNumber)
      const loaded = sorted.map((s) => ({ score1: String(s.score1), score2: String(s.score2) }))
      // Garante mínimo 2 games
      while (loaded.length < 2) loaded.push({ score1: '', score2: '' })
      setGames(loaded)
      if (matchStatus) setResultType(matchStatus as 'completed' | 'walkover' | 'retired')
    } else if (open && !isEdit) {
      setGames([{ score1: '', score2: '' }, { score1: '', score2: '' }])
      setResultType('completed')
    }
    setSubmitAttempted(false)
    setSubmitError(null)
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

      // A mensagem da API (ex.: TOURNAMENT_LOCKED, 409) é exibida no diálogo
      return apiFetch(`/draws/matches/${match!.id}/result`, {
        method: 'POST',
        json: { sets: validGames, status: resultType },
      })
    },
    onMutate: () => setSubmitError(null),
    onError: (err: Error) => setSubmitError(err.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', drawId] })
      queryClient.invalidateQueries({ queryKey: ['results', drawId] })
      // O aviso "Todas as partidas encerradas" da aba Chaveamento depende deste status.
      queryClient.invalidateQueries({ queryKey: ['all-draws-status'] })
      if (match) queryClient.invalidateQueries({ queryKey: ['result-history', match.id] })
      handleClose()
    },
  })

  function handleClose() {
    setGames([{ score1: '', score2: '' }, { score1: '', score2: '' }])
    setResultType('completed')
    setSubmitAttempted(false)
    setSubmitError(null)
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
      // Sempre 3 posições: sem isso o 3º game (índice 2) não existia no estado e a digitação se perdia.
      const slots = [0, 1, 2].map((i) => prev[i] ?? { score1: '', score2: '' })
      const updated = slots.map((g, i) => i === idx ? { ...g, [field]: value } : g)
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

  const showValidationError = submitAttempted && !isSpecialModeValid
  const setsWon = (side: 1 | 2) => displayGames.filter((g) => getGameWinner(g) === side).length
  const names = [player1Name, player2Name] as const
  // Veredito só com o placar fechado: o vencedor aparece antes de salvar (docs/DESIGN.md, Inputs > Placar).
  const verdict = winner && isSpecialModeValid
    ? resultType === 'completed'
      ? `Vitória de ${names[winner - 1]} por ${setsWon(winner)} sets a ${setsWon(winner === 1 ? 2 : 1)}`
      : `${resultType === 'walkover' ? 'W.O.' : 'Desistência'}: ${names[winner - 1]} avança`
    : null

  const scoreClass = (win: boolean) => cn(
    // `md:text-[1.75rem]` repete o tamanho para vencer o `md:text-sm` do Input.
    'h-14 w-12 px-0 text-center font-heading text-[1.75rem] font-bold tabular-nums sm:w-16 md:text-[1.75rem] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
    win && 'border-primary/50 bg-secondary text-secondary-foreground',
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-xl">
        {/* Formulário: Enter em qualquer campo salva (o rodapé ensina o atalho). */}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar resultado' : 'Lançar resultado'}</DialogTitle>
          <DialogDescription>{roundLabel}</DialogDescription>
        </DialogHeader>

        {isEdit && (
          <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            Se o vencedor mudar, as partidas seguintes serão reabertas automaticamente.
          </p>
        )}

        <ChoiceGroup
          legend="Tipo de resultado"
          hideLegend
          options={RESULT_TYPES}
          value={resultType}
          onChange={handleResultTypeChange}
          optionClassName="flex-1 font-semibold"
        />

        {/* Súmula: uma linha por lado e uma coluna por set. No HTML os campos seguem set a set
            (1º set lado 1, 1º set lado 2…), a ordem do Tab ao copiar a súmula de papel. */}
        {resultType === 'completed' && (
          <div role="group" aria-label="Parciais" className="grid grid-cols-[minmax(0,1fr)_repeat(3,3rem)] items-center gap-x-2 gap-y-2 sm:grid-cols-[minmax(0,1fr)_repeat(3,4rem)] sm:gap-x-3">
            {[0, 1, 2].map((idx) => (
              <span key={`h${idx}`} style={{ gridRow: 1, gridColumn: idx + 2 }} className="text-center text-[0.8125rem] font-semibold text-muted-foreground">
                {idx + 1}º set
              </span>
            ))}
            {names.map((name, i) => {
              const side = (i + 1) as 1 | 2
              return (
                <p key={`n${i}`} style={{ gridRow: i + 2, gridColumn: 1 }} className={cn('min-w-0 break-words leading-snug', winner === side ? 'font-semibold' : winner ? 'text-muted-foreground' : 'font-medium')}>
                  {name}
                  {winner === side && <span className="sr-only"> (vencedor)</span>}
                </p>
              )
            })}
            {[0, 1, 2].flatMap((idx) => {
              const game = displayGames[idx]
              const gw = getGameWinner(game)
              if (idx === 2 && !showThirdGame) {
                return [
                  <span key="g3-off" aria-hidden="true" style={{ gridRow: '2 / span 2', gridColumn: 4 }} className="flex h-full min-h-14 items-center justify-center rounded-md border border-dashed border-field-border text-sm text-muted-foreground">—</span>,
                ]
              }
              return ([1, 2] as const).map((side) => (
                <Input
                  key={`${idx}-${side}`}
                  type="number" inputMode="numeric" min={0} max={30} placeholder="–"
                  aria-label={`Pontos de ${names[side - 1]} no ${idx + 1}º set`}
                  aria-invalid={showValidationError || undefined}
                  aria-describedby={showValidationError ? ERROR_ID : undefined}
                  value={side === 1 ? game.score1 : game.score2}
                  onChange={(e) => updateGame(idx, side === 1 ? 'score1' : 'score2', e.target.value)}
                  style={{ gridRow: side + 1, gridColumn: idx + 2 }}
                  className={scoreClass(gw === side)}
                />
              ))
            })}
          </div>
        )}

        {/* Seleção de vencedor — W.O. e Ret. */}
        {resultType !== 'completed' && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {resultType === 'walkover'
                ? 'W.O.: selecione quem avança. O placar será registrado como 21–0 para o vencedor.'
                : 'Ret.: selecione quem estava vencendo quando a partida foi interrompida.'}
            </p>

            <ChoiceGroup
              legend={resultType === 'walkover' ? 'Quem avança?' : 'Quem estava vencendo?'}
              options={[
                { value: 'side1', label: player1Name },
                { value: 'side2', label: player2Name },
              ]}
              value={winner === 1 ? 'side1' : winner === 2 ? 'side2' : ''}
              onChange={(side) => {
                const game = side === 'side1' ? { score1: '21', score2: '0' } : { score1: '0', score2: '21' }
                setGames([game, game])
              }}
              className="space-y-2"
              optionClassName="flex-1 min-w-[40%] px-3 text-sm"
            />

            {showValidationError && (
              <p id={ERROR_ID} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                Selecione o vencedor antes de confirmar.
              </p>
            )}
          </div>
        )}

        {/* Erro de validação — modo Normal */}
        {resultType === 'completed' && showValidationError && gameValidationError && (
          <p id={ERROR_ID} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {gameValidationError}
          </p>
        )}

        <div role="status" aria-atomic="true">
          {verdict && (
            <p className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2.5 font-semibold text-secondary-foreground">
              <Check className="size-4 shrink-0" aria-hidden="true" />
              {verdict}
            </p>
          )}
        </div>

        {submitError && (
          <p role="alert" className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {submitError}
          </p>
        )}

        {/* Também em partida sem resultado: ela pode ter perdido um em cascata. */}
        {match && <ResultHistory matchId={match.id} enabled={open} />}

        <DialogFooter className="items-center gap-2">
          <p className="mr-auto hidden text-[0.8125rem] text-muted-foreground sm:block">
            <kbd className="rounded-sm border border-border bg-muted px-1.5 font-sans text-xs font-semibold">Tab</kbd> próximo campo ·{' '}
            <kbd className="rounded-sm border border-border bg-muted px-1.5 font-sans text-xs font-semibold">Enter</kbd> salva
          </p>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" />Salvando...</>
              : isEdit ? 'Salvar alterações' : 'Confirmar resultado'
            }
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
