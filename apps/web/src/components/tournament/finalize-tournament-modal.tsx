'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiError, apiFetch } from '@/lib/api'
import { AlertTriangle, Trophy, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

function readIncomplete(details: unknown): string[] | undefined {
  if (typeof details !== 'object' || details === null) return undefined
  const list = (details as { incomplete?: unknown }).incomplete
  return Array.isArray(list) && list.every((v) => typeof v === 'string') ? list : undefined
}

interface Props {
  tournamentId: string
  tournamentName: string
  open: boolean
  onClose: () => void
  onFinalized: () => void
}

const DISCIPLINE_LABEL: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.', WD: 'Duplas Fem.', XD: 'Misto',
}

const PLACEMENT_LABEL: Record<number, string> = { 1: '1º lugar', 2: '2º lugar', 3: '3º lugar' }

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
    // `apiFetch` lança `ApiError`, que guarda o texto da API em `message` (não em `error`).
    onError: (err: unknown) => {
      // Contrato { error, code, details }: a lista de pendências vem em `details.incomplete`.
      const incomplete = err instanceof ApiError ? readIncomplete(err.details) : undefined
      setApiError({
        error: err instanceof Error ? err.message : 'Erro desconhecido ao encerrar campeonato.',
        ...(incomplete ? { incomplete } : {}),
      })
    },
  })

  function handleClose() {
    setResult(null)
    setApiError(null)
    mutation.reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      {/* Sem o X do canto: cada estado tem o próprio botão de saída ("Cancelar" ou "Fechar"). */}
      <DialogContent showCloseButton={false} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-warning" aria-hidden="true" />
            {result ? 'Relatório Final' : 'Encerrar Campeonato'}
          </DialogTitle>
          <DialogDescription>
            {result
              ? `Resultado final de ${tournamentName}.`
              : `Confirme o encerramento de ${tournamentName}.`}
          </DialogDescription>
        </DialogHeader>

        {/* Estado: confirmação */}
        {!result && !apiError && (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-warning">Ação irreversível</p>
                <p className="text-sm text-warning">
                  Encerrar <strong>{tournamentName}</strong> irá:
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-warning">
                  <li>Bloquear novas inscrições definitivamente</li>
                  <li>Alterar o status para <strong>Encerrado</strong></li>
                  <li>Gerar o relatório final com os primeiros lugares</li>
                </ul>
                <p className="mt-2 text-xs text-warning">Todas as chaves precisam estar completamente jogadas.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? 'Encerrando...' : 'Confirmar encerramento'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Estado: erro (chaves incompletas ou outro) */}
        {apiError && (
          <>
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-destructive">{apiError.error}</p>
                {apiError.incomplete && apiError.incomplete.length > 0 && (
                  <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
                    {apiError.incomplete.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Estado: sucesso + relatório */}
        {result && (
          <>
            <div role="status" className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" aria-hidden="true" />
              <p className="text-sm font-semibold">Campeonato encerrado com sucesso!</p>
            </div>

            {result.report.map((cat) => (
              <section key={cat.categoryId} aria-label={cat.categoryName} className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 text-warning" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{cat.categoryName}</h3>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {DISCIPLINE_LABEL[cat.discipline] ?? cat.discipline}
                  </span>
                </div>
                {cat.podium.length > 0 ? (
                  <ol className="divide-y divide-border">
                    {cat.podium.map((entry) => (
                      <li key={entry.placement} className="flex items-center gap-3 px-4 py-3">
                        <span aria-hidden="true" className="w-8 text-center text-xl">{entry.medal}</span>
                        <div>
                          <p className="text-sm font-semibold">
                            <span className="sr-only">{PLACEMENT_LABEL[entry.placement] ?? `${entry.placement}º lugar`}: </span>
                            {entry.athleteName}
                          </p>
                          {entry.athlete2Name && <p className="text-xs text-muted-foreground">+ {entry.athlete2Name}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="px-4 py-3 text-xs text-muted-foreground">Sem dados de resultado para esta categoria.</p>
                )}
              </section>
            ))}

            <DialogFooter>
              <Button type="button" onClick={handleClose}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
