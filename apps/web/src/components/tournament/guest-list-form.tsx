'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'
import { isDoublesDiscipline } from '@/lib/labels'
import { cn } from '@/lib/utils'

type GuestError = { line: number; message: string }
type Summary = { registered: number; athletesCreated: number; athletesReused: number }

function lineErrors(error: unknown): GuestError[] {
  if (!(error instanceof ApiError) || typeof error.details !== 'object' || error.details === null) return []
  const errors = (error.details as { errors?: unknown }).errors
  return Array.isArray(errors) ? (errors as GuestError[]) : []
}

const EXAMPLE: Record<string, string> = {
  MS: 'Carlos Dias\nPedro Lima (2008)',
  WS: 'Ana Souza\nBia Lima (2008)',
  MD: 'Carlos Dias / Pedro Lima',
  WD: 'Ana Souza / Bia Lima',
  XD: 'Carlos Dias / Ana Souza',
}

/**
 * Amistoso: cola a lista de inscritos de uma categoria; cada nome vira (ou reaproveita) um jogador avulso,
 * inscrito e aprovado (`POST /tournaments/categories/:id/guests`).
 */
export function GuestListForm({ categoryId, discipline, onDone }: { categoryId: string; discipline: string; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const doubles = isDoublesDiscipline(discipline)

  const mutation = useMutation({
    mutationFn: () => apiFetch<Summary>(`/tournaments/categories/${categoryId}/guests`, { method: 'POST', json: { text } }),
    // O erro aparece no próprio formulário (linhas ou mensagem da API): sem o toast global.
    onError: () => {},
    onSuccess: (result) => {
      setSummary(result)
      setText('')
      void queryClient.invalidateQueries({ queryKey: ['registrations'] })
    },
  })
  const errors = lineErrors(mutation.error)

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setSummary(null); mutation.mutate() }}
      className="space-y-3 border-b border-border bg-muted/20 px-4 py-3"
    >
      <Field
        label="Jogadores (um por linha)"
        hint={
          doubles
            ? `Dupla com "/" entre os nomes${discipline === 'XD' ? ' (homem primeiro, mulher depois)' : ''}. Nome e sobrenome; ano de nascimento opcional entre parênteses.`
            : 'Nome e sobrenome; ano de nascimento opcional entre parênteses. O mesmo nome em outra categoria é o mesmo jogador.'
        }
        error={errors.length ? 'Corrija as linhas indicadas abaixo.' : mutation.error?.message}
      >
        {(props) => (
          <textarea
            {...props}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={EXAMPLE[discipline]}
            className={cn(FIELD_CONTROL_CLASS, 'h-auto min-h-32 py-2')}
          />
        )}
      </Field>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p className="font-semibold">Nada foi salvo. Corrija as linhas:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={`${e.line}-${e.message}`}>{e.line > 0 ? `Linha ${e.line}: ` : ''}{e.message}</li>
            ))}
          </ul>
        </div>
      )}
      {summary && (
        <p role="status" className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
          {summary.registered} {summary.registered === 1 ? 'inscrição criada' : 'inscrições criadas'} ·{' '}
          {summary.athletesCreated} {summary.athletesCreated === 1 ? 'jogador novo' : 'jogadores novos'} ·{' '}
          {summary.athletesReused} já {summary.athletesReused === 1 ? 'conhecido' : 'conhecidos'}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={mutation.isPending || !text.trim()}>
          {mutation.isPending ? 'Adicionando...' : mutation.isError && !errors.length ? 'Tentar de novo' : 'Adicionar jogadores'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>Fechar</Button>
      </div>
    </form>
  )
}
