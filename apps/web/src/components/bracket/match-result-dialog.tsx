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

type Set = { score1: string; score2: string }

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

function getSetWinner(set: Set): 1 | 2 | null {
  const s1 = parseInt(set.score1)
  const s2 = parseInt(set.score2)
  if (isNaN(s1) || isNaN(s2) || s1 === s2) return null
  return s1 > s2 ? 1 : 2
}

function inferMatchWinner(sets: Set[]): 1 | 2 | null {
  const wins1 = sets.filter((s) => getSetWinner(s) === 1).length
  const wins2 = sets.filter((s) => getSetWinner(s) === 2).length
  if (wins1 > wins2) return 1
  if (wins2 > wins1) return 2
  return null
}

export function MatchResultDialog({
  match, open, onClose, player1Name, player2Name, drawId, categoryId, existingResults,
}: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!existingResults?.length

  const [sets, setSets] = useState<Set[]>([{ score1: '', score2: '' }])
  const [resultType, setResultType] = useState<'completed' | 'walkover' | 'retired'>('completed')
  const [submitAttempted, setSubmitAttempted] = useState(false)

  useEffect(() => {
    if (open && isEdit && existingResults) {
      const sorted = [...existingResults].sort((a, b) => a.setNumber - b.setNumber)
      setSets(sorted.map((s) => ({ score1: String(s.score1), score2: String(s.score2) })))
      if (match?.status) setResultType(match.status as 'completed' | 'walkover' | 'retired')
    } else if (open && !isEdit) {
      setSets([{ score1: '', score2: '' }])
      setResultType('completed')
    }
    setSubmitAttempted(false)
  }, [open, isEdit])

  // Ao trocar para WO ou Ret., limpa os sets para forçar seleção do vencedor
  function handleResultTypeChange(type: 'completed' | 'walkover' | 'retired') {
    setResultType(type)
    if (type !== 'completed') {
      setSets([{ score1: '', score2: '' }])
    }
    setSubmitAttempted(false)
  }

  const winner = inferMatchWinner(sets)

  // Para WO: obriga sets com placar 21-0 ou 0-21 (vencedor selecionado)
  // Para Ret.: obriga ao menos um set preenchido
  const isSpecialModeValid =
    resultType === 'completed'
      ? winner !== null
      : winner !== null  // ambos WO e Ret. exigem vencedor identificável

  const { mutate: submitResult, isPending } = useMutation({
    mutationFn: async () => {
      const validSets = sets
        .map((s, i) => ({ setNumber: i + 1, score1: parseInt(s.score1), score2: parseInt(s.score2) }))
        .filter((s) => !isNaN(s.score1) && !isNaN(s.score2))

      if (!validSets.length) throw new Error('Nenhum set válido para enviar')

      const res = await fetch(`${API_URL}/draws/matches/${match!.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets: validSets, status: resultType }),
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
    setSets([{ score1: '', score2: '' }])
    setResultType('completed')
    setSubmitAttempted(false)
    onClose()
  }

  function handleSubmit() {
    setSubmitAttempted(true)
    if (!isSpecialModeValid) return
    submitResult()
  }

  function addSet() { setSets((p) => [...p, { score1: '', score2: '' }]) }
  function removeSet(idx: number) { setSets((p) => p.filter((_, i) => i !== idx)) }
  function updateSet(idx: number, field: 'score1' | 'score2', value: string) {
    setSets((p) => p.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const roundLabel = match?.round === 1 ? 'Final'
    : match?.round === 2 ? 'Semifinal'
    : match?.round === 3 ? 'Quartas de Final'
    : `Fase ${match?.round}`

  const showWinnerError = submitAttempted && !isSpecialModeValid

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
              {sets.filter((s) => getSetWinner(s) === 1).length} sets
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
              {sets.filter((s) => getSetWinner(s) === 2).length} sets
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

        {/* Sets — modo Normal */}
        {resultType === 'completed' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parciais</p>
              <button onClick={addSet} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="w-3 h-3" /> Adicionar set
              </button>
            </div>
            <div className="grid grid-cols-[1fr_40px_1fr_32px] gap-2 px-1">
              <p className="text-xs text-muted-foreground truncate">{player1Name.split(' ')[0]}</p>
              <div />
              <p className="text-xs text-muted-foreground truncate">{player2Name.split(' ')[0]}</p>
              <div />
            </div>
            {sets.map((set, idx) => {
              const sw = getSetWinner(set)
              return (
                <div key={idx} className="grid grid-cols-[1fr_40px_1fr_32px] gap-2 items-center">
                  <Input
                    type="number" min={0} max={30} placeholder="0"
                    value={set.score1}
                    onChange={(e) => updateSet(idx, 'score1', e.target.value)}
                    className={`text-center font-mono ${
                      sw === 1 ? 'border-green-400 bg-green-50 font-bold' : ''
                    }`}
                  />
                  <p className="text-center text-xs text-muted-foreground font-medium">S{idx + 1}</p>
                  <Input
                    type="number" min={0} max={30} placeholder="0"
                    value={set.score2}
                    onChange={(e) => updateSet(idx, 'score2', e.target.value)}
                    className={`text-center font-mono ${
                      sw === 2 ? 'border-green-400 bg-green-50 font-bold' : ''
                    }`}
                  />
                  <button
                    onClick={() => removeSet(idx)}
                    disabled={sets.length === 1}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Seleção de vencedor — W.O. e Ret. */}
        {resultType !== 'completed' && (
          <div className="space-y-3">
            {/* Instrução */}
            <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${
              resultType === 'walkover'
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {resultType === 'walkover'
                  ? 'W.O.: selecione quem avança. O placar será registrado como 21–0 para o vencedor. Quem deu W.O. não pontua no ranking.'
                  : 'Ret.: selecione quem estava vencendo quando a partida foi interrompida. O placar parcial será usado para determinar o vencedor.'}
              </span>
            </div>

            {/* Botões de seleção de vencedor */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quem avança?</p>
              <div className="grid grid-cols-2 gap-2">
                {[player1Name, player2Name].map((name, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSets(idx === 0
                      ? [{ score1: '21', score2: '0' }]
                      : [{ score1: '0', score2: '21' }]
                    )}
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

            {/* Parciais opcionais para Ret. */}
            {resultType === 'retired' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parciais jogados</p>
                  <button onClick={addSet} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="w-3 h-3" /> Adicionar set
                  </button>
                </div>
                <div className="grid grid-cols-[1fr_40px_1fr_32px] gap-2 px-1">
                  <p className="text-xs text-muted-foreground truncate">{player1Name.split(' ')[0]}</p>
                  <div />
                  <p className="text-xs text-muted-foreground truncate">{player2Name.split(' ')[0]}</p>
                  <div />
                </div>
                {sets.map((set, idx) => {
                  const sw = getSetWinner(set)
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_40px_1fr_32px] gap-2 items-center">
                      <Input
                        type="number" min={0} max={30} placeholder="0"
                        value={set.score1}
                        onChange={(e) => updateSet(idx, 'score1', e.target.value)}
                        className={`text-center font-mono ${
                          sw === 1 ? 'border-green-400 bg-green-50 font-bold' : ''
                        }`}
                      />
                      <p className="text-center text-xs text-muted-foreground font-medium">S{idx + 1}</p>
                      <Input
                        type="number" min={0} max={30} placeholder="0"
                        value={set.score2}
                        onChange={(e) => updateSet(idx, 'score2', e.target.value)}
                        className={`text-center font-mono ${
                          sw === 2 ? 'border-green-400 bg-green-50 font-bold' : ''
                        }`}
                      />
                      <button
                        onClick={() => removeSet(idx)}
                        disabled={sets.length === 1}
                        className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Erro de validação */}
            {showWinnerError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Selecione o vencedor antes de confirmar.
              </p>
            )}
          </div>
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
