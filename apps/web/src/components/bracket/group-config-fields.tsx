'use client'

import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'

export type GroupConfigForm = { groupCount: string; groupSize: string; advancePerGroup: string }

export const EMPTY_GROUP_CONFIG: GroupConfigForm = { groupCount: '', groupSize: '', advancePerGroup: '' }

/** Corpo da requisição de sorteio: só os campos preenchidos (o servidor completa e valida o resto). */
export function groupConfigBody(form: GroupConfigForm): Record<string, number> {
  const body: Record<string, number> = {}
  const count = Number(form.groupCount)
  const size = Number(form.groupSize)
  const advance = Number(form.advancePerGroup)
  if (form.groupCount.trim() && Number.isInteger(count)) body.groupCount = count
  else if (form.groupSize.trim() && Number.isInteger(size)) body.groupSize = size
  if (form.advancePerGroup.trim() && Number.isInteger(advance)) body.advancePerGroup = advance
  return body
}

/** Configuração da fase de grupos: número de grupos (ou pessoas por grupo) e classificados por grupo. */
export function GroupConfigFields({ value, onChange }: { value: GroupConfigForm; onChange: (next: GroupConfigForm) => void }) {
  const set = (patch: Partial<GroupConfigForm>) => onChange({ ...value, ...patch })
  return (
    <fieldset className="w-full space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold">Fase de grupos</legend>
      <p className="text-xs text-muted-foreground">
        Deixe em branco para o padrão: grupos de 4 pessoas e 2 classificados por grupo. Se informar o número de grupos,
        as pessoas por grupo são calculadas.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Número de grupos" muted>
          {(props) => (
            <input
              {...props}
              type="number"
              min={1}
              max={26}
              inputMode="numeric"
              value={value.groupCount}
              onChange={(e) => set({ groupCount: e.target.value })}
              placeholder="automático"
              className={FIELD_CONTROL_CLASS}
            />
          )}
        </Field>
        <Field label="Pessoas por grupo" muted>
          {(props) => (
            <input
              {...props}
              type="number"
              min={2}
              inputMode="numeric"
              value={value.groupSize}
              onChange={(e) => set({ groupSize: e.target.value })}
              disabled={value.groupCount.trim() !== ''}
              placeholder="4"
              className={FIELD_CONTROL_CLASS}
            />
          )}
        </Field>
        <Field label="Classificados por grupo" muted>
          {(props) => (
            <input
              {...props}
              type="number"
              min={1}
              inputMode="numeric"
              value={value.advancePerGroup}
              onChange={(e) => set({ advancePerGroup: e.target.value })}
              placeholder="2"
              className={FIELD_CONTROL_CLASS}
            />
          )}
        </Field>
      </div>
    </fieldset>
  )
}

/** Suíço: número de rodadas (vazio = ⌈log₂ inscritos⌉). */
export function SwissConfigFields({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <fieldset className="w-full space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold">Suíço</legend>
      <p className="text-xs text-muted-foreground">
        Deixe em branco para o padrão: ⌈log₂ do número de inscritos⌉ rodadas. Cada rodada é gerada depois que a anterior termina.
      </p>
      <Field label="Número de rodadas" muted>
        {(props) => (
          <input
            {...props}
            type="number"
            min={1}
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="automático"
            className={FIELD_CONTROL_CLASS}
          />
        )}
      </Field>
    </fieldset>
  )
}

export function swissConfigBody(rounds: string): Record<string, number> {
  const n = Number(rounds)
  return rounds.trim() && Number.isInteger(n) ? { swissRounds: n } : {}
}

/** Eliminação dupla: a grande final tem reset? */
export function DoubleEliminationConfigFields({ reset, onChange }: { reset: boolean; onChange: (next: boolean) => void }) {
  return (
    <fieldset className="w-full space-y-2 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold">Eliminação dupla</legend>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" checked={reset} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 rounded accent-primary" />
        <span>
          <span className="font-medium">Grande final com reset</span>
          <span className="block text-xs text-muted-foreground">
            Se quem veio da chave dos perdedores vencer a grande final, os dois jogam uma segunda vez (cada um tem uma derrota).
          </span>
        </span>
      </label>
    </fieldset>
  )
}
