'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarCheck, CheckCircle2, Loader2, Wand2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetch } from '@/lib/api'
import { DISCIPLINE_PILL } from '@/lib/discipline'
import {
  buildAutoScheduleRequest,
  groupAssignmentsByDay,
  validateAutoScheduleForm,
  type AutoScheduleAssignment,
  type AutoScheduleForm,
  type AutoScheduleFormErrors,
  type AutoScheduleRequest,
  type AutoScheduleResponse,
} from '@/lib/auto-schedule'

type Props = {
  tournamentId: string
  /** "YYYY-MM-DD": dia sugerido para o início da agenda. */
  defaultStartDate?: string
  open: boolean
  onClose: () => void
}

function initialForm(defaultStartDate?: string): AutoScheduleForm {
  const day = defaultStartDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultStartDate) ? defaultStartDate : null
  const today = new Date()
  const fallback = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return { courts: '2', startAt: `${day ?? fallback}T09:00`, matchMinutes: '40', restMinutes: '15', reschedule: false }
}

function matchLabel(a: { participant1: string | null; participant2: string | null }): string {
  return `${a.participant1 ?? 'A definir'} x ${a.participant2 ?? 'A definir'}`
}

function PreviewCell({ assignment }: { assignment: AutoScheduleAssignment | undefined }) {
  if (!assignment) return <span className="text-muted-foreground" aria-label="Quadra livre">—</span>
  const pill = DISCIPLINE_PILL[assignment.discipline] ?? 'bg-muted text-muted-foreground'
  return (
    <div className="space-y-1 min-w-40">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${pill}`}>{assignment.categoryName}</span>
        <span className="text-xs text-muted-foreground">{assignment.roundLabel}</span>
      </div>
      <p className="text-sm whitespace-normal">{matchLabel(assignment)}</p>
    </div>
  )
}

export function AutoScheduleDialog({ tournamentId, defaultStartDate, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<AutoScheduleForm>(() => initialForm(defaultStartDate))
  const [errors, setErrors] = useState<AutoScheduleFormErrors>({})
  const [preview, setPreview] = useState<AutoScheduleResponse | null>(null)
  const [previewRequest, setPreviewRequest] = useState<AutoScheduleRequest | null>(null)
  const [applied, setApplied] = useState<AutoScheduleResponse | null>(null)

  const path = `/tournaments/${tournamentId}/schedule/auto`

  const previewMutation = useMutation({
    mutationFn: (request: AutoScheduleRequest) => apiFetch<AutoScheduleResponse>(path, { method: 'POST', json: request }),
    onSuccess: (data, request) => {
      setPreview(data)
      setPreviewRequest(request)
    },
  })

  const applyMutation = useMutation({
    // Aplica exatamente o que foi pré-visualizado, só trocando dryRun.
    mutationFn: (request: AutoScheduleRequest) => apiFetch<AutoScheduleResponse>(path, { method: 'POST', json: { ...request, dryRun: false } }),
    onSuccess: (data) => {
      setApplied(data)
      queryClient.invalidateQueries({ queryKey: ['schedule-all', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  const days = useMemo(() => (preview ? groupAssignmentsByDay(preview.assignments) : []), [preview])
  const busy = previewMutation.isPending || applyMutation.isPending
  const error = applyMutation.error ?? previewMutation.error

  function update<K extends keyof AutoScheduleForm>(key: K, value: AutoScheduleForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    // Mudou um parâmetro: a pré-visualização antiga não vale mais.
    setPreview(null)
    setPreviewRequest(null)
    previewMutation.reset()
    applyMutation.reset()
  }

  function handlePreview() {
    const found = validateAutoScheduleForm(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    applyMutation.reset()
    previewMutation.mutate(buildAutoScheduleRequest(form, true))
  }

  function handleApply() {
    if (previewRequest) applyMutation.mutate(previewRequest)
  }

  function handleClose() {
    if (busy) return
    onClose()
    // Volta ao início para a próxima abertura.
    setApplied(null)
    setPreview(null)
    setPreviewRequest(null)
    previewMutation.reset()
    applyMutation.reset()
  }

  const fieldProps = (field: keyof AutoScheduleFormErrors) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `auto-schedule-${field}-error` : undefined,
    disabled: busy || applied !== null,
  })
  const fieldError = (field: keyof AutoScheduleFormErrors) =>
    errors[field] ? (
      <p id={`auto-schedule-${field}-error`} className="text-xs text-destructive">{errors[field]}</p>
    ) : null

  const canApply = preview !== null && preview.assignments.length > 0 && applied === null

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" aria-hidden="true" />
            Gerar agenda automática
          </DialogTitle>
          <DialogDescription>
            Distribui as partidas pelas quadras respeitando a ordem da chave e o descanso dos atletas. Pré-visualize antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            handlePreview()
          }}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="auto-schedule-courts">Quadras</Label>
            <Input
              id="auto-schedule-courts"
              type="number"
              inputMode="numeric"
              min={1}
              max={32}
              value={form.courts}
              onChange={(e) => update('courts', e.target.value)}
              {...fieldProps('courts')}
            />
            {fieldError('courts')}
          </div>
          <div className="space-y-1.5 lg:col-span-1">
            <Label htmlFor="auto-schedule-start">Início</Label>
            <Input
              id="auto-schedule-start"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => update('startAt', e.target.value)}
              {...fieldProps('startAt')}
            />
            {fieldError('startAt')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto-schedule-duration">Duração da partida (min)</Label>
            <Input
              id="auto-schedule-duration"
              type="number"
              inputMode="numeric"
              min={5}
              max={240}
              value={form.matchMinutes}
              onChange={(e) => update('matchMinutes', e.target.value)}
              {...fieldProps('matchMinutes')}
            />
            {fieldError('matchMinutes')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto-schedule-rest">Descanso entre partidas (min)</Label>
            <Input
              id="auto-schedule-rest"
              type="number"
              inputMode="numeric"
              min={0}
              max={240}
              value={form.restMinutes}
              onChange={(e) => update('restMinutes', e.target.value)}
              {...fieldProps('restMinutes')}
            />
            {fieldError('restMinutes')}
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2">
            <input
              id="auto-schedule-reschedule"
              type="checkbox"
              className="size-4 rounded border-input accent-primary"
              checked={form.reschedule}
              onChange={(e) => update('reschedule', e.target.checked)}
              disabled={busy || applied !== null}
            />
            <Label htmlFor="auto-schedule-reschedule" className="font-normal">
              Reagendar partidas já agendadas (as em andamento e as encerradas nunca mudam)
            </Label>
          </div>
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>

        <div aria-live="polite" className="space-y-4">
          {previewMutation.isPending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Calculando a proposta...
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error.message}
            </p>
          )}

          {applied && (
            <p role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              Agenda aplicada: {applied.summary.planned} {applied.summary.planned === 1 ? 'partida agendada' : 'partidas agendadas'}.
            </p>
          )}

          {preview && (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                {preview.summary.planned} {preview.summary.planned === 1 ? 'partida planejada' : 'partidas planejadas'}
                {days.length > 0 && <> em {days.length} {days.length === 1 ? 'dia' : 'dias'}</>}
                {preview.summary.unscheduled > 0 && <>, {preview.summary.unscheduled} sem horário</>}
              </p>

              {preview.warnings.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                  {preview.warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              )}

              {preview.assignments.length === 0 && preview.unscheduled.length === 0 && (
                <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
                  <CalendarCheck className="w-8 h-8 mx-auto mb-3 opacity-30" aria-hidden="true" />
                  <p className="font-medium">Nenhuma partida para agendar</p>
                  <p className="text-sm">
                    Todas as partidas pendentes já têm horário e quadra. Marque «Reagendar» para refazer a agenda.
                  </p>
                </div>
              )}

              {days.map((day) => (
                <section key={day.key} aria-labelledby={`auto-schedule-day-${day.key}`} className="space-y-2">
                  <h3 id={`auto-schedule-day-${day.key}`} className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {day.label}
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col" className="w-20">Horário</TableHead>
                          {day.courts.map((court) => (
                            <TableHead key={court} scope="col">Quadra {court}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {day.rows.map((row) => (
                          <TableRow key={row.time}>
                            <TableHead scope="row" className="font-mono">{row.time}</TableHead>
                            {day.courts.map((court) => (
                              <TableCell key={court} className="align-top whitespace-normal">
                                <PreviewCell assignment={row.cells.get(court)} />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              ))}

              {preview.unscheduled.length > 0 && (
                <section aria-labelledby="auto-schedule-unscheduled" className="space-y-2">
                  <h3 id="auto-schedule-unscheduled" className="px-1 text-xs font-semibold uppercase tracking-wider text-destructive">
                    Sem horário ({preview.unscheduled.length})
                  </h3>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {preview.unscheduled.map((item) => (
                      <li key={item.matchId} className="px-4 py-3 text-sm">
                        <p className="font-medium">{item.categoryName} · {item.roundLabel} · {matchLabel(item)}</p>
                        <p className="text-muted-foreground">{item.reason}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            {applied ? 'Fechar' : 'Cancelar'}
          </Button>
          {applied === null && (
            <Button variant="secondary" onClick={handlePreview} disabled={busy}>
              {previewMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />Calculando...</> : 'Pré-visualizar'}
            </Button>
          )}
          {applied === null && (
            <Button onClick={handleApply} disabled={busy || !canApply}>
              {applyMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />Aplicando...</> : 'Aplicar agenda'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
