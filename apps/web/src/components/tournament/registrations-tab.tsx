'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import type { RegistrationResponse, RegistrationStatus, TournamentStatus } from '@birdie-atlas/validators'
import { apiFetch } from '@/lib/api'
import { ATHLETE_SEARCH_LIMIT, useAthleteSearch, type AthleteOption } from '@/hooks/use-athlete-search'
import { UserPlus, Trash2, Trophy, Users, User, Check, X, RotateCcw } from 'lucide-react'

type Category = {
  id: string
  name: string
  discipline: string
}

type Registration = RegistrationResponse

const STATUS_BADGE: Record<RegistrationStatus, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-yellow-50 text-yellow-700' },
  approved: { label: 'Aprovada', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Recusada', className: 'bg-red-50 text-red-700' },
}

const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-100 text-blue-700',
  WS: 'bg-purple-100 text-purple-700',
  MD: 'bg-cyan-100 text-cyan-700',
  WD: 'bg-pink-100 text-pink-700',
  XD: 'bg-orange-100 text-orange-700',
}

const isDoubles = (discipline: string) => ['MD', 'WD', 'XD'].includes(discipline)

// Retorna qual gênero é permitido para o slot 1 de cada disciplina
function allowedGender1(discipline: string): 'M' | 'F' | 'any' {
  if (discipline === 'MS' || discipline === 'MD') return 'M'
  if (discipline === 'WS' || discipline === 'WD') return 'F'
  return 'any' // XD
}

// Para o slot 2 do XD, o gênero deve ser oposto ao do slot 1
function allowedGender2(discipline: string, gender1: 'M' | 'F' | ''): 'M' | 'F' | 'any' {
  if (discipline === 'MD') return 'M'
  if (discipline === 'WD') return 'F'
  if (discipline === 'XD') {
    if (gender1 === 'M') return 'F'
    if (gender1 === 'F') return 'M'
    return 'any'
  }
  return 'any'
}

interface Props {
  tournamentId: string
  tournamentStatus: TournamentStatus
  categories: Category[]
}

export function RegistrationsTab({ tournamentId, tournamentStatus, categories }: Props) {
  // Encerrado ou cancelado: a API recusa qualquer alteração, então a tela nem oferece
  const locked = tournamentStatus === 'completed' || tournamentStatus === 'cancelled'
  const queryClient = useQueryClient()
  const [selectedCategoryId, setActiveCategoryId] = useState<string>('')
  // As categorias chegam depois da primeira renderização: sem escolha explícita, usa a primeira
  const activeCategoryId = selectedCategoryId || categories[0]?.id || ''
  const [showForm, setShowForm] = useState(false)
  const [athlete1, setAthlete1] = useState<AthleteOption | null>(null)
  const [athlete2Id, setAthlete2Id] = useState('')
  const [search, setSearch] = useState('')
  const athleteId = athlete1?.id ?? ''
  const [seed, setSeed] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const doubles = activeCategory ? isDoubles(activeCategory.discipline) : false
  const discipline = activeCategory?.discipline ?? ''

  // Chave própria: a lista pública usa ['registrations', categoryId] com outro formato de resposta
  const { data, isLoading } = useQuery<Paginated<Registration>>({
    queryKey: ['registrations', 'admin', tournamentId, activeCategoryId],
    queryFn: () => apiFetch(`/registrations/tournament/${tournamentId}?categoryId=${activeCategoryId}&pageSize=100`),
    enabled: !!activeCategoryId,
  })
  const registrations = data?.data ?? []
  const total = data?.pagination.total ?? 0

  // Atletas que já ocupam uma vaga na categoria (recusadas liberam a vaga)
  const registeredAthleteIds = new Set(
    registrations
      .filter((r) => r.status !== 'rejected')
      .flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[])
  )

  // Busca no servidor já filtrada pelo gênero permitido em cada slot
  const g1 = allowedGender1(discipline)
  const g2 = allowedGender2(discipline, athlete1?.gender ?? '')
  const slot1 = useAthleteSearch(search, g1 === 'any' ? undefined : g1)
  const slot2 = useAthleteSearch(search, g2 === 'any' ? undefined : g2)

  const athletesForSlot1 = slot1.athletes.filter((a) => !registeredAthleteIds.has(a.id))
  const athletesForSlot2 = slot2.athletes.filter(
    (a) => a.id !== athleteId && !registeredAthleteIds.has(a.id)
  )
  // O atleta escolhido continua no select mesmo se a busca mudar
  if (athlete1 && !athletesForSlot1.some((a) => a.id === athlete1.id)) athletesForSlot1.unshift(athlete1)
  const searchTruncated = slot1.total > ATHLETE_SEARCH_LIMIT || slot2.total > ATHLETE_SEARCH_LIMIT

  const addMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/tournaments/categories/${activeCategoryId}/register`, {
        method: 'POST',
        json: {
          athleteId,
          athlete2Id: doubles && athlete2Id ? athlete2Id : undefined,
          seed: seed ? Number(seed) : undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] })
      setAthlete1(null)
      setAthlete2Id('')
      setSeed('')
      setError(null)
      setShowForm(false)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao inscrever atleta'
      setError(msg)
    },
  })

  // Sem onError próprio: o erro da API (ex.: REGISTRATION_IN_DRAW) aparece no toast global
  const removeMutation = useMutation({
    mutationFn: (registrationId: string) =>
      apiFetch(`/tournaments/registrations/${registrationId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registrations'] }),
  })

  const approveMutation = useMutation({
    mutationFn: (registrationId: string) =>
      apiFetch(`/registrations/${registrationId}/approve`, { method: 'POST', json: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registrations'] }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: RegistrationStatus; notes?: string }) =>
      apiFetch(`/registrations/${id}`, { method: 'PATCH', json: { status, ...(notes !== undefined ? { notes } : {}) } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] })
      setRejectingId(null)
      setRejectReason('')
    },
  })

  const busy = removeMutation.isPending || approveMutation.isPending || statusMutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!athleteId) { setError('Selecione o atleta'); return }
    if (doubles && !athlete2Id) { setError('Selecione o parceiro para esta disciplina'); return }
    addMutation.mutate()
  }

  // Limpa slot 2 quando muda o atleta 1 (evita par inválido em XD)
  function handleAthlete1Change(id: string) {
    setAthlete1(athletesForSlot1.find((a) => a.id === id) ?? null)
    setAthlete2Id('')
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
        Nenhuma categoria criada neste torneio ainda.
      </div>
    )
  }

  // Label de hint abaixo do select de atleta
  const genderHint: Record<string, string> = {
    MS: 'Apenas atletas masculinos',
    WS: 'Apenas atletas femininas',
    MD: 'Apenas atletas masculinos',
    WD: 'Apenas atletas femininas',
    XD: 'Um atleta masculino e uma feminina',
  }

  return (
    <div className="space-y-4">
      {/* Seletor de categoria */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategoryId(cat.id); setShowForm(false); setError(null); setAthlete1(null); setAthlete2Id('') }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              activeCategoryId === cat.id
                ? (disciplineColors[cat.discipline] ?? 'bg-gray-100 text-gray-700') + ' border-transparent'
                : 'border-border text-muted-foreground hover:text-foreground bg-background'
            }`}
          >
            {isDoubles(cat.discipline) ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {cat.name}
            {activeCategoryId === cat.id && <span className="opacity-60">({total})</span>}
          </button>
        ))}
      </div>

      {/* Tabela de inscritos */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold">
            {activeCategory?.name} —{' '}
            <span className="text-muted-foreground font-normal">
              {isLoading ? '...' : `${total} ${total === 1 ? 'inscrição' : 'inscrições'}`}
            </span>
          </p>
          {locked ? (
            <span className="text-xs text-muted-foreground">Torneio encerrado: inscrições bloqueadas</span>
          ) : (
            <button
              onClick={() => { setShowForm((v) => !v); setError(null) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Inscrever
            </button>
          )}
        </div>

        {/* Formulário inline */}
        {showForm && !locked && (
          <form onSubmit={handleSubmit} className="px-4 py-3 border-b border-border bg-muted/20 space-y-3">
            {discipline && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Regra de gênero:</span> {genderHint[discipline]}
              </p>
            )}
            <div className="space-y-1">
              <label htmlFor="registration-athlete-search" className="text-xs text-muted-foreground font-medium">
                Buscar atleta
              </label>
              <input
                id="registration-athlete-search"
                type="search"
                placeholder="Nome ou e-mail"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {searchTruncated && (
                <p className="text-xs text-muted-foreground">
                  Mostrando os {ATHLETE_SEARCH_LIMIT} primeiros resultados. Refine a busca para encontrar outros atletas.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">
                  {doubles ? 'Atleta 1 *' : 'Atleta *'}
                </label>
                <select
                  value={athleteId}
                  onChange={(e) => handleAthlete1Change(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecionar...</option>
                  {athletesForSlot1.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {athletesForSlot1.length === 0 && (
                  <p className="text-xs text-amber-600">Nenhum atleta disponível para esta categoria.</p>
                )}
              </div>

              {doubles && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Atleta 2 *</label>
                  <select
                    value={athlete2Id}
                    onChange={(e) => setAthlete2Id(e.target.value)}
                    disabled={discipline === 'XD' && !athleteId}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="">
                      {discipline === 'XD' && !athleteId ? 'Selecione o atleta 1 primeiro' : 'Selecionar...'}
                    </option>
                    {athletesForSlot2.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
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
                {addMutation.isPending ? 'Inscrevendo...' : 'Confirmar inscrição'}
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
            {registrations.map((reg, index) => {
              const badge = STATUS_BADGE[reg.status]
              const iconBtn = 'shrink-0 p-1.5 rounded-lg text-muted-foreground transition-colors disabled:opacity-50'
              return (
                <div key={reg.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="w-6 text-center text-xs text-muted-foreground font-mono shrink-0">{index + 1}</span>

                    {reg.seed ? (
                      <span className="inline-flex items-center gap-1 w-8 shrink-0">
                        <Trophy className="w-3 h-3 text-yellow-500" aria-hidden="true" />
                        <span className="text-xs font-semibold text-yellow-600">{reg.seed}</span>
                      </span>
                    ) : (
                      <span className="w-8 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${reg.status === 'rejected' ? 'line-through text-muted-foreground' : ''}`}>
                        {reg.athleteName ?? reg.athleteId}
                        {reg.athlete2Name && (
                          <span className="text-muted-foreground"> / {reg.athlete2Name}</span>
                        )}
                      </p>
                    </div>

                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}>{badge.label}</span>

                    {!locked && (
                      <div className="flex items-center gap-1 shrink-0">
                        {reg.status === 'pending' && (
                          <button
                            onClick={() => approveMutation.mutate(reg.id)}
                            disabled={busy}
                            className={`${iconBtn} hover:bg-green-50 hover:text-green-600`}
                            title="Aprovar inscrição"
                            aria-label={`Aprovar inscrição de ${reg.athleteName ?? reg.athleteId}`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {reg.status !== 'rejected' && (
                          <button
                            onClick={() => { setRejectingId(reg.id); setRejectReason('') }}
                            disabled={busy}
                            className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}
                            title="Recusar inscrição"
                            aria-label={`Recusar inscrição de ${reg.athleteName ?? reg.athleteId}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {reg.status === 'rejected' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: reg.id, status: 'pending' })}
                            disabled={busy}
                            className={`${iconBtn} hover:bg-muted hover:text-foreground`}
                            title="Reabrir como pendente"
                            aria-label={`Reabrir inscrição de ${reg.athleteName ?? reg.athleteId}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => removeMutation.mutate(reg.id)}
                          disabled={busy}
                          className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}
                          title="Remover inscrição"
                          aria-label={`Remover inscrição de ${reg.athleteName ?? reg.athleteId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {reg.status === 'rejected' && reg.notes && (
                    <p className="mt-1 ml-[3.5rem] text-xs text-muted-foreground">Motivo: {reg.notes}</p>
                  )}

                  {rejectingId === reg.id && (
                    <form
                      className="mt-2 ml-[3.5rem] flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        statusMutation.mutate({ id: reg.id, status: 'rejected', notes: rejectReason.trim() })
                      }}
                    >
                      <label htmlFor={`reject-reason-${reg.id}`} className="sr-only">Motivo da recusa</label>
                      <input
                        id={`reject-reason-${reg.id}`}
                        autoFocus
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Motivo da recusa (obrigatório)"
                        maxLength={1000}
                        className="flex-1 h-8 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="submit"
                        disabled={busy || !rejectReason.trim()}
                        className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Recusar
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancelar
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
