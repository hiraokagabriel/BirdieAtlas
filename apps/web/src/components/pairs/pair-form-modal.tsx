'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { X, Search, Users } from 'lucide-react'

type Athlete = {
  id: string
  name: string
  gender: 'M' | 'F'
  photoUrl: string | null
  active: boolean
}

type Pair = {
  id: string
  athlete1Id: string
  athlete2Id: string
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
  { value: 'MD', label: 'Duplas Masc. (MD)' },
  { value: 'WD', label: 'Duplas Fem. (WD)' },
  { value: 'XD', label: 'Misto (XD)' },
] as const

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

function AthleteSelector({
  label, value, onChange, athletes, excludeId,
}: {
  label: string
  value: string
  onChange: (id: string) => void
  athletes: Athlete[]
  excludeId?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)

  const selected = athletes.find((a) => a.id === value)
  const filtered = athletes
    .filter((a) => a.id !== excludeId)
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-left flex items-center gap-2 hover:bg-muted/50 transition-colors"
        >
          {selected ? (
            <>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: selected.gender === 'M' ? '#3b82f6' : '#ec4899' }}
              >
                {initials(selected.name)}
              </div>
              <span className="flex-1 truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Selecionar atleta...</span>
          )}
        </button>

        {open && (
          <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar atleta..."
                  className="w-full h-8 rounded-md border border-border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum atleta encontrado</p>
              ) : (
                filtered.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                    onClick={() => { onChange(a.id); setOpen(false); setSearch('') }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: a.gender === 'M' ? '#3b82f6' : '#ec4899' }}
                    >
                      {initials(a.name)}
                    </div>
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.gender === 'M' ? 'M' : 'F'}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function PairFormModal({ open, pair, onClose, onSaved }: Props) {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [athlete1Id, setAthlete1Id] = useState('')
  const [athlete2Id, setAthlete2Id] = useState('')
  const [discipline, setDiscipline] = useState<'MD' | 'WD' | 'XD'>('MD')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    apiFetch<Athlete[]>('/athletes').then(setAthletes).catch(() => {})
  }, [])

  useEffect(() => {
    if (pair) {
      setAthlete1Id(pair.athlete1Id)
      setAthlete2Id(pair.athlete2Id)
      setDiscipline(pair.discipline)
    } else {
      setAthlete1Id('')
      setAthlete2Id('')
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
          body: JSON.stringify({ discipline }),
        })
      } else {
        // Busca tenantId do primeiro atleta via afiliação
        const affiliations = await apiFetch<{ tenantId: string }[]>(
          `/affiliations?athleteId=${athlete1Id}`
        )
        const tenantId = affiliations[0]?.tenantId ?? 'default'

        await apiFetch('/pairs', {
          method: 'POST',
          body: JSON.stringify({ tenantId, athlete1Id, athlete2Id, discipline }),
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">{pair ? 'Editar dupla' : 'Nova dupla'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Atleta 1 */}
          <AthleteSelector
            label="Atleta 1"
            value={athlete1Id}
            onChange={setAthlete1Id}
            athletes={athletes}
            excludeId={athlete2Id}
          />

          {/* Atleta 2 */}
          <AthleteSelector
            label="Atleta 2"
            value={athlete2Id}
            onChange={setAthlete2Id}
            athletes={athletes}
            excludeId={athlete1Id}
          />

          {/* Disciplina */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Disciplina</label>
            <div className="flex gap-2">
              {DISCIPLINES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDiscipline(value)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    discipline === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {value}
                  <span className="block text-xs font-normal opacity-70">
                    {value === 'MD' ? 'Masc.' : value === 'WD' ? 'Fem.' : 'Misto'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Erro */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : pair ? 'Salvar' : 'Criar dupla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
