'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { X, AlertTriangle, Trophy, CheckCircle2 } from 'lucide-react'

type PodiumEntry = {
  placement: number
  medal: string
  athleteId: string
  athleteName: string
  athlete2Id: string | null
  athlete2Name: string | null
}

type CategoryReport = {
  categoryId: string
  categoryName: string
  discipline: string
  podium: PodiumEntry[]
}

type FinalizeResult = {
  message: string
  report: CategoryReport[]
}

type FinalizeError = {
  error: string
  incomplete?: string[]
}

interface Props {
  tournamentId: string
  tournamentName: string
  open: boolean
  onClose: () => void
  onFinalized: () => void
}

export function FinalizeTournamentModal({ tournamentId, tournamentName, open, onClose, onFinalized }: Props) {
  const [result, setResult] = useState<FinalizeResult | null>(null)
  const [apiError, setApiError] = useState<FinalizeError | null>(null)

  const mutation = useMutation({
    mutationFn: () => apiFetch<FinalizeResult>(`/tournaments/${tournamentId}/finalize`, { method: 'POST' }),
    onSuccess: (data) => {
      setResult(data)
      setApiError(null)
      onFinalized()
    },
    onError: async (err: unknown) => {
      try {
        const data = err as FinalizeError
        setApiError(data)
      } catch {
        setApiError({ error: 'Erro desconhecido ao encerrar campeonato.' })
      }
    },
  })

  function handleClose() {
    setResult(null)
    setApiError(null)
    onClose()
  }

  if (!open) return null

  const disciplineLabel: Record<string, string> = {
    MS: 'Simples Masc.', WS: 'Simples Fem.',
    MD: 'Duplas Masc.', WD: 'Duplas Fem.', XD: 'Misto',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-2xl bg-background rounded-2xl border border-border shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="text-base font-semibold">
              {result ? 'Relatório Final' : 'Encerrar Campeonato'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Estado: confirmação */}
          {!result && !apiError && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-yellow-800">Ação irreversível</p>
                  <p className="text-sm text-yellow-700">
                    Encerrar <strong>{tournamentName}</strong> irá:
                  </p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside space-y-0.5">
                    <li>Bloquear novas inscrições definitivamente</li>
                    <li>Alterar o status para <strong>Encerrado</strong></li>
                    <li>Gerar o relatório final com os primeiros lugares</li>
                  </ul>
                  <p className="text-xs text-yellow-600 mt-2">Todas as chaves precisam estar completamente jogadas.</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {mutation.isPending ? 'Encerrando...' : 'Confirmar encerramento'}
                </button>
              </div>
            </div>
          )}

          {/* Estado: erro (chaves incompletas ou outro) */}
          {apiError && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-red-800">{apiError.error}</p>
                  {apiError.incomplete && apiError.incomplete.length > 0 && (
                    <ul className="text-sm text-red-700 space-y-1">
                      {apiError.incomplete.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-red-400 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* Estado: sucesso + relatório */}
          {result && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm font-semibold">Campeonato encerrado com sucesso!</p>
              </div>

              {result.report.map((cat) => (
                <div key={cat.categoryId} className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold text-sm">{cat.categoryName}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      {disciplineLabel[cat.discipline] ?? cat.discipline}
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {cat.podium.map((entry) => (
                      <div key={entry.placement} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-xl w-8 text-center">{entry.medal}</span>
                        <div>
                          <p className="text-sm font-semibold">{entry.athleteName}</p>
                          {entry.athlete2Name && (
                            <p className="text-xs text-muted-foreground">+ {entry.athlete2Name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {cat.podium.length === 0 && (
                      <p className="px-4 py-3 text-xs text-muted-foreground">Sem dados de resultado para esta categoria.</p>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <button onClick={handleClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
