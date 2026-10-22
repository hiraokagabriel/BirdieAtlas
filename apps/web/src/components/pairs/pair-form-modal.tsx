'use client'

import { useEffect, useId, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { ATHLETE_SEARCH_LIMIT, useAthleteSearch } from '@/hooks/use-athlete-search'
import { Search } from 'lucide-react'
import { genderAvatarClass } from '@/lib/discipline'
import { Button } from '@/components/ui/button'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Athlete = {
  id: string
  name: string
  gender: 'M' | 'F'
}

type Pair = {
  id: string
  athlete1Id: string
  athlete2Id: string
  athlete1?: Athlete | null
  athlete2?: Athlete | null
  discipline: 'MD' | 'WD' | 'XD'
  active: boolean
}

type Props = {
  open: boolean
  pair: Pair | null
  onClose: () => void
  onSaved: () => void
}

const DISCIPLINES = [
  { value: 'MD', label: 'MD, Duplas masculinas', content: <span className="text-center">MD<span className="block text-xs font-normal">Masc.</span></span> },
  { value: 'WD', label: 'WD, Duplas femininas', content: <span className="text-center">WD<span className="block text-xs font-normal">Fem.</span></span> },
  { value: 'XD', label: 'XD, Duplas mistas', content: <span className="text-center">XD<span className="block text-xs font-normal">Misto</span></span> },
] as const

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

/**
 * Escolha de atleta com busca: botão que abre um painel (padrão de divulgação, `aria-expanded`) com um campo
 * de busca rotulado e a lista de resultados como botões. O atleta escolhido aparece no nome do botão.
 */
function AthleteSelector({
  label, value, onChange, excludeId,
}: {
  label: string
  value: Athlete | null
  onChange: (athlete: Athlete) => void
  excludeId?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const { athletes, total } = useAthleteSearch(search)
  const base = useId()
  const labelId = `${base}-label`
  const panelId = `${base}-panel`
  const searchId = `${base}-search`
  const valueId = `${base}-value`

  const selected = value
  const filtered = athletes.filter((a) => a.id !== excludeId)

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="block text-sm font-medium">{label}</span>
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-labelledby={`${labelId} ${valueId}`}
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-field-border bg-background px-3 text-left text-sm transition-colors hover:bg-muted/50"
        >
          <span id={valueId} className="flex min-w-0 flex-1 items-center gap-2">
            {selected ? (
              <>
                <span
                  aria-hidden="true"
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${genderAvatarClass(selected.gender)}`}
                >
                  {initials(selected.name)}
                </span>
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Selecionar atleta...</span>
            )}
          </span>
        </button>

        {open && (
          <div id={panelId} className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <div className="border-b border-border p-2">
              <label htmlFor={searchId} className="sr-only">Buscar atleta para {label}</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id={searchId}
                  autoFocus
                  type="search"
                  placeholder="Buscar atleta..."
                  className="h-8 w-full rounded-md border border-field-border bg-background pl-8 pr-3 text-sm focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Nenhum atleta encontrado</p>
              ) : (
                <ul>
                  {filtered.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        aria-pressed={a.id === selected?.id}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                        onClick={() => { onChange(a); setOpen(false); setSearch('') }}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${genderAvatarClass(a.gender)}`}
                        >
                          {initials(a.name)}
                        </span>
                        <span className="flex-1 truncate">{a.name}</span>
                        <span className="text-xs text-muted-foreground">
                          <span className="sr-only">Gênero </span>
                          {a.gender === 'M' ? 'M' : 'F'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {total > ATHLETE_SEARCH_LIMIT && (
              <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Refine a busca: mostrando {ATHLETE_SEARCH_LIMIT} de {total}.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function PairFormModal({ open, pair, onClose, onSaved }: Props) {
  const [athlete1, setAthlete1] = useState<Athlete | null>(null)
  const [athlete2, setAthlete2] = useState<Athlete | null>(null)
  const athlete1Id = athlete1?.id ?? ''
  const athlete2Id = athlete2?.id ?? ''
  const [discipline, setDiscipline] = useState<'MD' | 'WD' | 'XD'>('MD')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    if (pair) {
      setAthlete1(pair.athlete1 ?? null)
      setAthlete2(pair.athlete2 ?? null)
      setDiscipline(pair.discipline)
    } else {
      setAthlete1(null)
      setAthlete2(null)
      setDiscipline('MD')
    }
    setError(null)
  }, [pair, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!athlete1Id || !athlete2Id) {
      setError('Selecione os dois atletas.')
      return
    }
    if (athlete1Id === athlete2Id) {
      setError('Os dois atletas devem ser diferentes.')
      return
    }

    setSaving(true)
    try {
      if (pair) {
        await apiFetch(`/pairs/${pair.id}`, {
          method: 'PUT',
          json: { discipline },
        })
      } else {
        await apiFetch('/pairs', {
          method: 'POST',
          json: { athlete1Id, athlete2Id, discipline },
        })
      }
      onSaved()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar dupla.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pair ? 'Editar dupla' : 'Nova dupla'}</DialogTitle>
          <DialogDescription>
            {pair ? 'Só a disciplina da dupla pode ser alterada.' : 'Escolha os dois atletas e a disciplina da dupla.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <AthleteSelector label="Atleta 1" value={athlete1} onChange={setAthlete1} excludeId={athlete2Id} />
          <AthleteSelector label="Atleta 2" value={athlete2} onChange={setAthlete2} excludeId={athlete1Id} />

          <ChoiceGroup
            legend="Disciplina"
            options={DISCIPLINES}
            value={discipline}
            onChange={setDiscipline}
            className="space-y-1.5"
            optionClassName="flex-1 py-2 text-xs"
          />

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : pair ? 'Salvar' : 'Criar dupla'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
