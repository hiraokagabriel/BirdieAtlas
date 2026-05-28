'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { UserPlus, Trash2, Trophy, Users, User } from 'lucide-react'

type Category = {
  id: string
  name: string
  discipline: string
}

type Registration = {
  id: string
  athleteId: string
  athlete2Id: string | null
  athleteName: string | null
  athlete2Name: string | null
  seed: number | null
  confirmed: boolean
  withdrew: boolean
}

type Athlete = {
  id: string
  name: string
  gender: 'M' | 'F'
}

const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-100 text-blue-700',
  WS: 'bg-purple-100 text-purple-700',
  MD: 'bg-cyan-100 text-cyan-700',
  WD: 'bg-pink-100 text-pink-700',
  XD: 'bg-orange-100 text-orange-700',
}

const isDoubles = (discipline: string) => ['MD', 'WD', 'XD'].includes(discipline)

interface Props {
  tournamentId: string
  categories: Category[]
}

export function RegistrationsTab({ tournamentId, categories }: Props) {
  const queryClient = useQueryClient()
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? '')
  const [showForm, setShowForm] = useState(false)
  const [athleteId, setAthleteId] = useState('')
  const [athlete2Id, setAthlete2Id] = useState('')
  const [seed, setSeed] = useState('')
  const [error, setError] = useState<string | null>(null)

  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const doubles = activeCategory ? isDoubles(activeCategory.discipline) : false

  // Inscri\u00e7\u00f5es da categoria ativa
  const { data: registrations = [], isLoading } = useQuery<Registration[]>({
    queryKey: ['registrations', activeCategoryId],
    queryFn: () => apiFetch(`/tournaments/categories/${activeCategoryId}/registrations`),
    enabled: !!activeCategoryId,
  })

  // Lista de atletas para o autocomplete
  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ['athletes'],
    queryFn: () => apiFetch('/athletes'),
  })

  const addMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/tournaments/categories/${activeCategoryId}/registrations`, {
        method: 'POST',
        json: {
          athleteId,
          athlete2Id: doubles && athlete2Id ? athlete2Id : undefined,
          seed: seed ? Number(seed) : undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations', activeCategoryId] })
      setAthleteId('')
      setAthlete2Id('')
      setSeed('')
      setError(null)
      setShowForm(false)
    },
    onError: async (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao inscrever atleta'
      setError(msg)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (registrationId: string) =>
      apiFetch(`/tournaments/registrations/${registrationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations', activeCategoryId] })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!athleteId) { setError('Selecione o atleta'); return }
    if (doubles && !athlete2Id) { setError('Selecione o parceiro para esta disciplina'); return }
    addMutation.mutate()
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
        Nenhuma categoria criada neste torneio ainda.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Seletor de categoria */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategoryId(cat.id); setShowForm(false); setError(null) }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              activeCategoryId === cat.id
                ? (disciplineColors[cat.discipline] ?? 'bg-gray-100 text-gray-700') + ' border-transparent'
                : 'border-border text-muted-foreground hover:text-foreground bg-background'
            }`}
          >
            {isDoubles(cat.discipline) ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {cat.name}
            <span className="opacity-60">({registrations.length})</span>
          </button>
        ))}
      </div>

      {/* Tabela de inscritos */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold">
            {activeCategory?.name} —{' '}
            <span className="text-muted-foreground font-normal">
              {isLoading ? '...' : `${registrations.length} inscrito${registrations.length !== 1 ? 's' : ''}`}
            </span>
          </p>
          <button
            onClick={() => { setShowForm((v) => !v); setError(null) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Inscrever
          </button>
        </div>

        {/* Formul\u00e1rio inline */}
        {showForm && (
          <form onSubmit={handleSubmit} className="px-4 py-3 border-b border-border bg-muted/20 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Atleta *</label>
                <select
                  value={athleteId}
                  onChange={(e) => setAthleteId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecionar atleta...</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.gender})</option>
                  ))}
                </select>
              </div>

              {doubles && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Parceiro *</label>
                  <select
                    value={athlete2Id}
                    onChange={(e) => setAthlete2Id(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Selecionar parceiro...</option>
                    {athletes.filter((a) => a.id !== athleteId).map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.gender})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Seed (opcional)</label>
                <input
                  type="number" min={1} placeholder="ex: 1"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 font-medium">{error}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {addMutation.isPending ? 'Inscrevendo...' : 'Confirmar inscri\u00e7\u00e3o'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null) }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : registrations.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum inscrito nesta categoria ainda.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {registrations.map((reg, index) => (
              <div key={reg.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                {/* Posi\u00e7\u00e3o */}
                <span className="w-6 text-center text-xs text-muted-foreground font-mono shrink-0">{index + 1}</span>

                {/* Seed badge */}
                {reg.seed ? (
                  <span className="inline-flex items-center gap-1 w-8 shrink-0">
                    <Trophy className="w-3 h-3 text-yellow-500" />
                    <span className="text-xs font-semibold text-yellow-600">{reg.seed}</span>
                  </span>
                ) : (
                  <span className="w-8 shrink-0" />
                )}

                {/* Nome(s) */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {reg.athleteName ?? reg.athleteId}
                    {reg.athlete2Name && (
                      <span className="text-muted-foreground"> / {reg.athlete2Name}</span>
                    )}
                  </p>
                </div>

                {/* Status */}
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  reg.confirmed ? 'bg-green-100 text-green-700' : 'bg-yellow-50 text-yellow-700'
                }`}>
                  {reg.confirmed ? 'Confirmado' : 'Pendente'}
                </span>

                {/* Remover */}
                <button
                  onClick={() => removeMutation.mutate(reg.id)}
                  disabled={removeMutation.isPending}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"
                  title="Remover inscri\u00e7\u00e3o"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
