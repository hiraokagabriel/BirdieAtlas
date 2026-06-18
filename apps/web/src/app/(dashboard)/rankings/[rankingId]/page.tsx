'use client'

import { use, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import {
  ChevronLeft, RefreshCw, Plus, Trash2,
  ChevronRight, ChevronDown, Users, User, Zap, CheckCircle2, Clock,
  Settings, X, Trophy, Shield, Save, Medal,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PointRulesManager } from '@/components/ranking/point-rules-manager'

type Ranking = {
  id: string; name: string; description: string | null
  discipline: string; year: number; autoInclude: boolean
  countBestResults: number | null
  minTournamentsRequired: number
}
type Tournament = {
  id: string; name: string; slug: string; status: string; level: string
  startDate: string; endDate: string; city: string | null; state: string | null
  pointsAwarded: boolean; tenantId: string
}
type AthleteData = { id: string; name: string; gender: string }
type TournamentResult = { tournamentId: string; points: number; placement: number }
type Entry = {
  id: string
  position: number
  totalPoints: number
  tournamentsCount: number
  athleteId: string
  athlete2Id: string | null
  athlete: AthleteData | null
  athlete2: AthleteData | null
  resultsDetail: TournamentResult[]
}
type RankingResponse = {
  ranking: Ranking; entries: Entry[]
  pagination: { page: number; perPage: number; total: number; totalPages: number }
}
type EditForm = {
  name: string
  description: string
  countBestResults: string
  minTournamentsRequired: string
  autoInclude: boolean
}

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? ''

const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.',  WD: 'Duplas Fem.', XD: 'Misto',
}
const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-500/10 text-blue-700 border-blue-200',
  WS: 'bg-purple-500/10 text-purple-700 border-purple-200',
  MD: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
  WD: 'bg-pink-500/10 text-pink-700 border-pink-200',
  XD: 'bg-orange-500/10 text-orange-700 border-orange-200',
}

const statusLabel: Record<string, string> = {
  draft: 'Rascunho', registration_open: 'Inscrições abertas',
  registration_closed: 'Inscrições encerradas',
  in_progress: 'Em andamento', completed: 'Encerrado', cancelled: 'Cancelado',
}

const placementLabel = (p: number) => {
  if (p === 1) return '🥇 1º'
  if (p === 2) return '🥈 2º'
  if (p === 3) return '🥉 3º'
  return `${p}º`
}

function PositionBadge({ pos }: { pos: number }) {
  if (pos === 1) return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-yellow-900 font-bold text-sm">🥇</span>
  if (pos === 2) return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-gray-800 font-bold text-sm">🥈</span>
  if (pos === 3) return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-600/80 text-white font-bold text-sm">🥉</span>
  return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-semibold text-sm">{pos}</span>
}

// ---------------------------------------------------------------------------
// Painel de detalhes de resultados por torneio
// ---------------------------------------------------------------------------
function ResultsDetail({
  results,
  countBestResults,
  tournamentMap,
}: {
  results: TournamentResult[]
  countBestResults: number | null
  tournamentMap: Map<string, string>
}) {
  // A API já devolve resultsDetail ordenado por pontos desc
  const sorted = [...results].sort((a, b) => b.points - a.points)
  const cutoff = countBestResults ?? sorted.length

  return (
    <div className="px-5 pb-4 pt-1">
      <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Torneio</span>
          <span className="text-center">Colocação</span>
          <span className="text-right">Pontos</span>
        </div>
        {sorted.map((r, i) => {
          const counted = i < cutoff
          const name = tournamentMap.get(r.tournamentId) ?? 'Torneio desconhecido'
          return (
            <div
              key={r.tournamentId}
              className={`grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2.5 border-b border-border/50 last:border-0 text-sm ${
                counted ? '' : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {countBestResults !== null && (
                  <span className={`shrink-0 w-2 h-2 rounded-full ${
                    counted ? 'bg-green-500' : 'bg-muted-foreground/40'
                  }`} />
                )}
                <span className="truncate text-muted-foreground">{name}</span>
              </div>
              <span className="text-center tabular-nums text-muted-foreground">{placementLabel(r.placement)}</span>
              <span className={`text-right tabular-nums font-medium ${
                counted ? 'text-foreground' : 'text-muted-foreground line-through'
              }`}>
                {r.points.toLocaleString('pt-BR')}
              </span>
            </div>
          )
        })}
        {countBestResults !== null && sorted.length > countBestResults && (
          <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
            {sorted.length - countBestResults} resultado{sorted.length - countBestResults !== 1 ? 's' : ''} descartado{sorted.length - countBestResults !== 1 ? 's' : ''} (fora do top {countBestResults})
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Linha de classificação (expansível)
// ---------------------------------------------------------------------------
function EntryRow({
  entry,
  isDoubles,
  ranking,
  tournamentMap,
}: {
  entry: Entry
  isDoubles: boolean
  ranking: Ranking
  tournamentMap: Map<string, string>
}) {
  const [open, setOpen] = useState(false)
  const hasDetails = entry.resultsDetail && entry.resultsDetail.length > 0
  const isTop3 = entry.position <= 3

  return (
    <>
      <div
        className={`grid grid-cols-[3rem_1fr_auto_2rem] gap-4 px-5 py-3.5 border-b border-border/50 last:border-0 ${
          isTop3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
        } ${hasDetails ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
        onClick={() => hasDetails && setOpen((v) => !v)}
        role={hasDetails ? 'button' : undefined}
        aria-expanded={hasDetails ? open : undefined}
      >
        <div className="flex items-center"><PositionBadge pos={entry.position} /></div>

        <div className="flex flex-col justify-center min-w-0">
          {isDoubles ? (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium text-sm">
                <Link
                  href={`/athletes/${entry.athleteId}`}
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {entry.athlete?.name ?? '—'}
                </Link>
                {' & '}
                <Link
                  href={entry.athlete2Id ? `/athletes/${entry.athlete2Id}` : '#'}
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {entry.athlete2?.name ?? '—'}
                </Link>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Link
                href={`/athletes/${entry.athleteId}`}
                className="font-medium text-sm hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {entry.athlete?.name ?? '—'}
              </Link>
            </div>
          )}
          {entry.tournamentsCount > 0 && (
            <span className="text-xs text-muted-foreground mt-0.5">
              {entry.tournamentsCount} torneio{entry.tournamentsCount !== 1 ? 's' : ''}
              {ranking.countBestResults && entry.tournamentsCount > ranking.countBestResults
                ? ` · top ${ranking.countBestResults} contados`
                : ''}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end">
          <span className={`font-semibold tabular-nums ${
            isTop3 ? 'text-yellow-700 text-base' : 'text-sm'
          }`}>
            {entry.totalPoints.toLocaleString('pt-BR')}
          </span>
        </div>

        <div className="flex items-center justify-center">
          {hasDetails && (
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
      </div>

      {open && hasDetails && (
        <ResultsDetail
          results={entry.resultsDetail}
          countBestResults={ranking.countBestResults}
          tournamentMap={tournamentMap}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function RankingDetailPage({ params }: { params: Promise<{ rankingId: string }> }) {
  const { rankingId } = use(params)
  const router = useRouter()

  const [ranking, setRanking]   = useState<Ranking | null>(null)
  const [data, setData]         = useState<RankingResponse | null>(null)
  const [linkedTournaments, setLinkedTournaments] = useState<Tournament[]>([])
  const [allTournaments, setAllTournaments]       = useState<Tournament[]>([])
  const [tournamentMap, setTournamentMap]         = useState<Map<string, string>>(new Map())
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [recalcLoading, setRecalc] = useState(false)
  const [tab, setTab]           = useState<'entries' | 'tournaments' | 'rules'>('entries')
  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [linking, setLinking]   = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving]     = useState(false)
  const PER_PAGE = 25

  useEffect(() => {
    apiFetch<Ranking>(`/rankings/${rankingId}`).then((r) => {
      setRanking(r)
      setEditForm({
        name: r.name,
        description: r.description ?? '',
        countBestResults: r.countBestResults != null ? String(r.countBestResults) : '',
        minTournamentsRequired: String(r.minTournamentsRequired),
        autoInclude: r.autoInclude,
      })
    })
  }, [rankingId])

  useEffect(() => {
    if (!rankingId) return
    setLoading(true)
    apiFetch<RankingResponse>(`/rankings/${rankingId}/entries?page=${page}&perPage=${PER_PAGE}`)
      .then(setData).finally(() => setLoading(false))
  }, [rankingId, page])

  useEffect(() => {
    apiFetch<Tournament[]>(`/rankings/${rankingId}/tournaments`).then((list) => {
      setLinkedTournaments(list)
      setTournamentMap(new Map(list.map((t) => [t.id, t.name])))
    })
  }, [rankingId])

  useEffect(() => {
    const url = TENANT_ID ? `/tournaments?tenantId=${TENANT_ID}` : '/tournaments'
    apiFetch<Tournament[]>(url).then((list) => {
      setAllTournaments(list)
      // Merge com o tournamentMap existente para cobrir autoInclude
      setTournamentMap((prev) => {
        const next = new Map(prev)
        list.forEach((t) => next.set(t.id, t.name))
        return next
      })
    })
  }, [])

  const linkedIds  = new Set(linkedTournaments.map((t) => t.id))
  const unlinkable = linkedTournaments
  const linkable   = allTournaments.filter((t) => !linkedIds.has(t.id) && t.pointsAwarded)

  async function handleRecalculate() {
    setRecalc(true)
    try {
      await apiFetch(`/rankings/${rankingId}/recalculate`, { method: 'POST' })
      setPage(1)
      const res = await apiFetch<RankingResponse>(`/rankings/${rankingId}/entries?page=1&perPage=${PER_PAGE}`)
      setData(res)
    } finally {
      setRecalc(false)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm) return
    setSaving(true)
    try {
      const updated = await apiFetch<Ranking>(`/rankings/${rankingId}`, {
        method: 'PUT',
        json: {
          name: editForm.name,
          description: editForm.description || undefined,
          autoInclude: editForm.autoInclude,
          countBestResults: editForm.countBestResults ? Number(editForm.countBestResults) : null,
          minTournamentsRequired: Number(editForm.minTournamentsRequired),
        },
      })
      setRanking(updated)
      setShowEdit(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleLink(tournamentId: string) {
    setLinking(tournamentId)
    try {
      await apiFetch(`/rankings/${rankingId}/tournaments/${tournamentId}`, { method: 'POST' })
      const t = allTournaments.find((t) => t.id === tournamentId)!
      setLinkedTournaments((prev) => [...prev, t])
      setTournamentMap((prev) => new Map(prev).set(t.id, t.name))
    } finally {
      setLinking(null)
    }
  }

  async function handleUnlink(tournamentId: string) {
    setUnlinking(tournamentId)
    try {
      await apiFetch(`/rankings/${rankingId}/tournaments/${tournamentId}`, { method: 'DELETE' })
      setLinkedTournaments((prev) => prev.filter((t) => t.id !== tournamentId))
    } finally {
      setUnlinking(null)
    }
  }

  const isDoubles  = ranking ? ['MD', 'WD', 'XD'].includes(ranking.discipline) : false
  const pagination = data?.pagination

  if (!ranking || !editForm) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 rounded bg-muted" />
      <div className="h-24 rounded-xl bg-muted" />
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* MODAL DE EDIÇÃO */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Editar Ranking</h3>
              <button type="button" onClick={() => setShowEdit(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Nome *</label>
                <input
                  type="text" required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => f && ({ ...f, name: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Descrição</label>
                <input
                  type="text" placeholder="Descrição opcional"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => f && ({ ...f, description: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regras de contagem</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Trophy className="w-3 h-3" />
                    Melhores resultados
                  </label>
                  <input
                    type="number" min={1} max={99} placeholder="Todos (padrão)"
                    value={editForm.countBestResults}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, countBestResults: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">Vazio = conta todos.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    Mínimo de torneios
                  </label>
                  <input
                    type="number" min={0} max={99}
                    value={editForm.minTournamentsRequired}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, minTournamentsRequired: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">0 = sem restrição.</p>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editForm.autoInclude}
                onChange={(e) => setEditForm((f) => f && ({ ...f, autoInclude: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">
                <span className="font-medium">Inclusão automática</span>
                <span className="text-muted-foreground ml-1.5">— todos os torneios com pontos distribuídos</span>
              </span>
            </label>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button type="button" onClick={() => setShowEdit(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VOLTAR */}
      <button
        onClick={() => router.push('/rankings')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para Rankings
      </button>

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">{ranking.name}</h2>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium ${
              disciplineColors[ranking.discipline] ?? ''
            }`}>
              {isDoubles ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {disciplineLabel[ranking.discipline] ?? ranking.discipline}
            </span>
            {ranking.autoInclude && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs">
                <Zap className="w-3 h-3" />
                Inclusão automática
              </span>
            )}
            {ranking.countBestResults && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs">
                <Trophy className="w-3 h-3" />
                Top {ranking.countBestResults} torneios
              </span>
            )}
            {ranking.minTournamentsRequired > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 text-xs">
                <Shield className="w-3 h-3" />
                Mín. {ranking.minTournamentsRequired} torneios
              </span>
            )}
          </div>
          {ranking.description && <p className="text-sm text-muted-foreground">{ranking.description}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={handleRecalculate}
            disabled={recalcLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${recalcLoading ? 'animate-spin' : ''}`} />
            {recalcLoading ? 'Recalculando...' : 'Recalcular'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-border">
        {(['entries', 'tournaments', 'rules'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'entries'     && `Classificação${data ? ` (${data.pagination.total})` : ''}`}
            {t === 'tournaments' && `Torneios (${linkedTournaments.length})`}
            {t === 'rules'       && 'Regras de Pontos'}
          </button>
        ))}
      </div>

      {/* TAB: ENTRIES */}
      {tab === 'entries' && (
        <div className="space-y-4">

          {/* Banner de regras ativas */}
          {(ranking.countBestResults || ranking.minTournamentsRequired > 0) && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex flex-wrap items-center gap-x-4 gap-y-1">
              {ranking.countBestResults && (
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  Contando os <strong>{ranking.countBestResults} melhores</strong> resultados por atleta
                </span>
              )}
              {ranking.minTournamentsRequired > 0 && (
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Mínimo de <strong>{ranking.minTournamentsRequired}</strong> torneio{ranking.minTournamentsRequired !== 1 ? 's' : ''} para participar
                </span>
              )}
              <span className="flex items-center gap-1.5 ml-auto text-blue-600">
                <Medal className="w-3.5 h-3.5" />
                Clique em uma linha para ver o detalhamento
              </span>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Cabeçalho da tabela */}
            <div className="grid grid-cols-[3rem_1fr_auto_2rem] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>#</span>
              <span>{isDoubles ? 'Dupla' : 'Atleta'}</span>
              <span className="text-right">Pontos</span>
              <span />
            </div>

            {loading ? (
              <div>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[3rem_1fr_auto_2rem] gap-4 px-5 py-3.5 border-b border-border/50 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-muted" />
                    <div className="h-3.5 w-40 bg-muted rounded self-center" />
                    <div className="h-4 w-16 bg-muted rounded self-center" />
                    <div />
                  </div>
                ))}
              </div>
            ) : !data?.entries.length ? (
              <div className="p-12 text-center text-muted-foreground">
                <p className="font-medium">Nenhuma entrada ainda.</p>
                <p className="text-sm mt-1">Vincule torneios e clique em Recalcular.</p>
              </div>
            ) : (
              data.entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  isDoubles={isDoubles}
                  ranking={ranking}
                  tournamentMap={tournamentMap}
                />
              ))
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, pagination.total)} de {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium px-2">{page} / {pagination.totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: TOURNAMENTS */}
      {tab === 'tournaments' && (
        <div className="space-y-6">
          {ranking.autoInclude && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
              <Zap className="w-4 h-4 shrink-0" />
              Este ranking usa inclusão automática — todos os torneios com pontos distribuídos são considerados ao recalcular.
              Os vínculos manuais abaixo são ignorados nesse modo.
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Torneios vinculados</h3>
            {unlinkable.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum torneio vinculado ainda.</p>
            ) : (
              <div className="space-y-2">
                {unlinkable.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.startDate).toLocaleDateString('pt-BR')} · {statusLabel[t.status] ?? t.status}
                        {t.pointsAwarded && ' · ✅ Pontos distribuídos'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnlink(t.id)}
                      disabled={unlinking === t.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {linkable.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Disponíveis para vincular</h3>
              <div className="space-y-2">
                {linkable.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-muted-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.startDate).toLocaleDateString('pt-BR')} · {statusLabel[t.status] ?? t.status}
                      </p>
                    </div>
                    <button
                      onClick={() => handleLink(t.id)}
                      disabled={linking === t.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {linking === t.id ? 'Vinculando...' : 'Vincular'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: REGRAS DE PONTOS */}
      {tab === 'rules' && (
        <div className="rounded-xl border border-border bg-card p-6">
          <PointRulesManager rankingId={rankingId} />
        </div>
      )}

    </div>
  )
}
