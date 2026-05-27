'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CalendarClock, X } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Match = {
  id: string
  round: number
  scheduledAt: string | null
  courtNumber: number | null
}

type Props = {
  match: Match | null
  open: boolean
  onClose: () => void
  player1Name: string
  player2Name: string
  drawId: string
}

export function ScheduleDialog({ match, open, onClose, player1Name, player2Name, drawId }: Props) {
  const queryClient = useQueryClient()
  const [scheduledAt, setScheduledAt] = useState('')
  const [courtNumber, setCourtNumber] = useState('')

  useEffect(() => {
    if (open && match) {
      setScheduledAt(match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : '')
      setCourtNumber(match.courtNumber ? String(match.courtNumber) : '')
    }
  }, [open, match])

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/draws/matches/${match!.id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: scheduledAt || null,
          courtNumber: courtNumber ? parseInt(courtNumber) : null,
        }),
      })
      if (!res.ok) throw new Error('Erro ao agendar')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', drawId] })
      onClose()
    },
  })

  const roundLabel = match?.round === 1 ? 'Final'
    : match?.round === 2 ? 'Semifinal'
    : match?.round === 3 ? 'Quartas de Final'
    : `Fase ${match?.round}`

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Agendar Partida
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{roundLabel} — {player1Name} vs {player2Name}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scheduled-at">Data e hora</Label>
            <Input
              id="scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="court">Quadra</Label>
            <Input
              id="court"
              type="number"
              min={1}
              placeholder="Ex: 1"
              value={courtNumber}
              onChange={(e) => setCourtNumber(e.target.value)}
            />
          </div>
        </div>

        {match?.scheduledAt && (
          <button
            onClick={() => { setScheduledAt(''); setCourtNumber('') }}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:underline"
          >
            <X className="w-3 h-3" /> Remover agendamento
          </button>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={() => mutate()} disabled={isPending}>
            {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
