'use client'

import { useState } from 'react'
import {
  TOURNAMENT_TRANSITIONS,
  dedicatedTransitionEndpoint,
  type TournamentStatus,
} from '@birdie-atlas/validators'
import { Ban, DoorClosed, DoorOpen, Play } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

const ACTIONS: Partial<Record<TournamentStatus, { label: string; icon: typeof Play; confirm?: string; destructive?: boolean }>> = {
  registration_open:   { label: 'Abrir inscrições', icon: DoorOpen },
  registration_closed: { label: 'Encerrar inscrições', icon: DoorClosed },
  in_progress:         { label: 'Iniciar torneio', icon: Play },
  cancelled: {
    label: 'Cancelar torneio',
    icon: Ban,
    destructive: true,
    confirm: 'Cancelar o torneio? Um torneio cancelado não pode voltar a nenhum outro status.',
  },
}

/**
 * Botões das transições simples permitidas a partir do status atual.
 * Encerrar e reabrir ficam com os fluxos próprios da página (pódio e reversão de pontos).
 */
export function TournamentStatusActions({
  tournamentId,
  status,
  onChanged,
}: {
  tournamentId: string
  status: TournamentStatus
  onChanged: () => void
}) {
  const [pending, setPending] = useState<TournamentStatus | null>(null)
  const targets = TOURNAMENT_TRANSITIONS[status].filter((to) => !dedicatedTransitionEndpoint(status, to))

  async function transition(to: TournamentStatus) {
    const action = ACTIONS[to]
    if (action?.confirm && !confirm(action.confirm)) return
    setPending(to)
    try {
      await apiFetch(`/tournaments/${tournamentId}/transition`, { method: 'POST', json: { to } })
      onChanged()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível mudar o status', description: err instanceof Error ? err.message : String(err) })
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      {targets.map((to) => {
        const action = ACTIONS[to]
        if (!action) return null
        const Icon = action.icon
        return (
          <button
            key={to}
            type="button"
            onClick={() => transition(to)}
            disabled={pending !== null}
            className={
              action.destructive
                ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-50 transition-colors'
                : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors'
            }
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {pending === to ? 'Salvando...' : action.label}
          </button>
        )
      })}
    </>
  )
}
