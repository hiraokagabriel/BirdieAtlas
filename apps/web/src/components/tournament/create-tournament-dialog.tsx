'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { TOURNAMENT_LEVELS, TOURNAMENT_LEVEL_LABELS, type TournamentLevel } from '@birdie-atlas/validators'
import { apiFetch } from '@/lib/api'
import { focusFirstInvalid } from '@/lib/focus-invalid'
import { Button } from '@/components/ui/button'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'

type Kind = 'official' | 'friendly'

interface Form {
  kind: Kind
  name: string
  slug: string
  level: TournamentLevel
  startDate: string
  endDate: string
  city: string
  state: string
  location: string
}

const EMPTY: Form = { kind: 'official', name: '', slug: '', level: 'state', startDate: '', endDate: '', city: '', state: '', location: '' }

const KINDS = [
  { value: 'official', label: 'Oficial', content: <span>Oficial<span className="block text-xs font-normal">Pontua nos rankings</span></span>, labelFromContent: true },
  { value: 'friendly', label: 'Amistoso', content: <span>Amistoso<span className="block text-xs font-normal">Não pontua; tudo fica salvo</span></span>, labelFromContent: true },
] as const

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type Errors = Partial<Record<'name' | 'slug' | 'startDate' | 'endDate', string>>

function validate(form: Form): Errors {
  const errors: Errors = {}
  if (!form.name.trim()) errors.name = 'Informe o nome do torneio.'
  if (!form.slug.trim()) errors.slug = 'Informe o endereço (slug).'
  else if (!/^[a-z0-9-]+$/.test(form.slug)) errors.slug = 'Use só letras minúsculas, números e hífens.'
  if (!form.startDate) errors.startDate = 'Informe a data de início.'
  if (!form.endDate) errors.endDate = 'Informe a data de término.'
  else if (form.startDate && form.endDate < form.startDate) errors.endDate = 'O término não pode ser antes do início.'
  return errors
}

/** Botão "Novo torneio" e o diálogo de criação. Ao criar, abre o torneio para configurar categorias e inscrições. */
export function CreateTournamentDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const patch = (next: Partial<Form>) => setForm((f) => ({ ...f, ...next }))

  function close() {
    setOpen(false)
    setForm(EMPTY)
    setSlugTouched(false)
    setErrors({})
    setApiError(null)
  }

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(ev.currentTarget)
      return
    }
    setSaving(true)
    setApiError(null)
    try {
      const created = await apiFetch<{ id: string }>('/tournaments', {
        method: 'POST',
        json: {
          kind: form.kind,
          name: form.name.trim(),
          slug: form.slug.trim(),
          level: form.level,
          startDate: form.startDate,
          endDate: form.endDate,
          ...(form.city.trim() ? { city: form.city.trim() } : {}),
          ...(form.state.trim() ? { state: form.state.trim().toUpperCase() } : {}),
          ...(form.location.trim() ? { location: form.location.trim() } : {}),
        },
      })
      close()
      router.push(`/admin/tournaments/${created.id}`)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Não foi possível criar o torneio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Novo torneio
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo torneio</DialogTitle>
            <DialogDescription>
              Depois de criar você define categorias, formato de chave e inscrições. Torneio amistoso guarda tudo, mas não pontua;
              dá para torná-lo oficial depois, em Configurações.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} noValidate className="grid gap-4">
            <ChoiceGroup legend="Tipo" options={KINDS} value={form.kind} onChange={(kind) => patch({ kind })} className="space-y-1" optionClassName="flex-1 py-2" />

            <Field label="Nome" required error={errors.name}>
              {(props) => (
                <input
                  {...props}
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value, ...(slugTouched ? {} : { slug: toSlug(e.target.value) }) })}
                  placeholder="ex: Aberto de Verão 2026"
                  autoComplete="off"
                  className={FIELD_CONTROL_CLASS}
                />
              )}
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Endereço (slug)" required hint="Usado na URL pública." error={errors.slug}>
                {(props) => (
                  <input
                    {...props}
                    value={form.slug}
                    onChange={(e) => { setSlugTouched(true); patch({ slug: e.target.value }) }}
                    className={`${FIELD_CONTROL_CLASS} font-mono`}
                  />
                )}
              </Field>
              <Field label="Nível" hint={form.kind === 'friendly' ? 'Só vale se virar oficial.' : undefined} muted>
                {(props) => (
                  <select {...props} value={form.level} onChange={(e) => patch({ level: e.target.value as TournamentLevel })} className={`${FIELD_CONTROL_CLASS} cursor-pointer`}>
                    {TOURNAMENT_LEVELS.map((l) => <option key={l} value={l}>{TOURNAMENT_LEVEL_LABELS[l]}</option>)}
                  </select>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Início" required error={errors.startDate}>
                {(props) => <input {...props} type="date" value={form.startDate} onChange={(e) => patch({ startDate: e.target.value, ...(form.endDate ? {} : { endDate: e.target.value }) })} className={FIELD_CONTROL_CLASS} />}
              </Field>
              <Field label="Término" required error={errors.endDate}>
                {(props) => <input {...props} type="date" value={form.endDate} onChange={(e) => patch({ endDate: e.target.value })} className={FIELD_CONTROL_CLASS} />}
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Cidade (opcional)" muted>
                {(props) => <input {...props} value={form.city} onChange={(e) => patch({ city: e.target.value })} className={FIELD_CONTROL_CLASS} />}
              </Field>
              <Field label="Estado (opcional)" muted>
                {(props) => <input {...props} value={form.state} maxLength={2} onChange={(e) => patch({ state: e.target.value.toUpperCase() })} className={`${FIELD_CONTROL_CLASS} uppercase`} />}
              </Field>
              <Field label="Local (opcional)" muted>
                {(props) => <input {...props} value={form.location} onChange={(e) => patch({ location: e.target.value })} placeholder="ex: Ginásio Central" className={FIELD_CONTROL_CLASS} />}
              </Field>
            </div>

            {apiError && <p role="alert" className="text-xs font-medium text-destructive">{apiError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar torneio'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
