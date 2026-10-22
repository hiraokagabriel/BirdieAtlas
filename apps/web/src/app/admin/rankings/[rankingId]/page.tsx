'use client'

import { Fragment, use, useEffect, useState } from 'react'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import {
  ChevronLeft, RefreshCw, Plus, Trash2,
  ChevronRight, ChevronDown, Users, User, Zap, CheckCircle2, Clock,
  Settings, Trophy, Shield, Save,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PointRulesManager } from '@/components/ranking/point-rules-manager'
import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DISCIPLINE_PILL } from '@/lib/discipline'
import { useDocumentTitle } from '@/hooks/use-document-title'

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
type RankingResponse = Paginated<Entry> & { ranking: Ranking }
type EditForm = {
  name: string
  description: string
  countBestResults: string
  minTournamentsRequired: string
  autoInclude: boolean
}
type RankingTab = 'entries' | 'tournaments' | 'rules'

const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.',  WD: 'Duplas Fem.', XD: 'Misto',
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
const placementText = (p: number) => `${p}º lugar`

function PositionBadge({ pos }: { pos: number }) {
  if (pos === 1) return <span aria-hidden="true" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-medal-gold text-medal-gold-foreground font-bold text-sm">🥇</span>
  if (pos === 2) return <span aria-hidden="true" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-medal-silver text-medal-silver-foreground font-bold text-sm">🥈</span>
  if (pos === 3) return <span aria-hidden="true" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-medal-bronze text-medal-bronze-foreground font-bold text-sm">🥉</span>
  return <span aria-hidden="true" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-semibold text-sm">{pos}</span>
}

// ---------------------------------------------------------------------------
// Painel de detalhes de resultados por torneio
// ---------------------------------------------------------------------------
function ResultsDetail({
  id,
  athleteName,
  results,
  countBestResults,
  tournamentMap,
}: {
  id: string
  athleteName: string
  results: TournamentResult[]
  countBestResults: number | null
  tournamentMap: Map<string, string>
}) {
  // A API já devolve resultsDetail ordenado por pontos desc
  const sorted = [...results].sort((a, b) => b.points - a.points)
  const cutoff = countBestResults ?? sorted.length

  return (
    <div id={id} className="px-5 pb-4 pt-1">
      <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
        <table className="w-full text-sm">
          <caption className="sr-only">Resultados de {athleteName} por torneio</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <th scope="col" className="px-3 py-2 text-left">Torneio</th>
              <th scope="col" className="px-3 py-2 text-center">Colocação</th>
              <th scope="col" className="px-3 py-2 text-right">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const counted = i < cutoff
              const name = tournamentMap.get(r.tournamentId) ?? 'Torneio desconhecido'
              return (
                <tr key={r.tournamentId} className="border-b border-border/50 last:border-0">
                  <th scope="row" className="px-3 py-2.5 text-left font-normal">
                    <span className="flex items-center gap-2 min-w-0">
                      {countBestResults !== null && (
                        <span aria-hidden="true" className={`shrink-0 w-2 h-2 rounded-full ${counted ? 'bg-success' : 'bg-muted-foreground/60'}`} />
                      )}
                      <span className="truncate text-muted-foreground">{name}</span>
                      {countBestResults !== null && (
                        <span className="text-xs text-muted-foreground">{counted ? '(conta)' : '(descartado)'}</span>
                      )}
                    </span>
                  </th>
                  <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                    <span aria-hidden="true">{placementLabel(r.placement)}</span>
                    <span className="sr-only">{placementText(r.placement)}</span>
                  </td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                    counted ? 'text-foreground' : 'text-muted-foreground line-through'
                  }`}>
                    {r.points.toLocaleString('pt-BR')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {countBestResults !== null && sorted.length > countBestResults && (
          <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/20 flex items-center gap-1.5">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-muted-foreground/60 shrink-0" />
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
  const detailId = `ranking-entry-${entry.id}-details`
  const names = isDoubles
    ? `${entry.athlete?.name ?? '—'} e ${entry.athlete2?.name ?? '—'}`
    : (entry.athlete?.name ?? '—')

  return (
    <Fragment>
      <tr
        className={`border-b border-border/50 last:border-0 ${isTop3 ? 'bg-medal-gold/10' : ''} ${
          hasDetails ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''
        }`}
        onClick={() => hasDetails && setOpen((v) => !v)}
      >
        <td className="px-5 py-3.5 w-12">
          <PositionBadge pos={entry.position} />
          <span className="sr-only">{entry.position}º</span>
        </td>

        <td className="px-2 py-3.5 min-w-0">
          {isDoubles ? (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="font-medium text-sm">
                <Link
                  href={`/a/${entry.athleteId}`}
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {entry.athlete?.name ?? '—'}
                </Link>
                {' & '}
                {entry.athlete2Id ? (
                  <Link
                    href={`/a/${entry.athlete2Id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {entry.athlete2?.name ?? '—'}
                  </Link>
                ) : (
                  <span>{entry.athlete2?.name ?? '—'}</span>
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <Link
                href={`/a/${entry.athleteId}`}
                className="font-medium text-sm hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {entry.athlete?.name ?? '—'}
              </Link>
            </div>
          )}
          {entry.tournamentsCount > 0 && (
            <span className="block text-xs text-muted-foreground mt-0.5">
              {entry.tournamentsCount} torneio{entry.tournamentsCount !== 1 ? 's' : ''}
              {ranking.countBestResults && entry.tournamentsCount > ranking.countBestResults
                ? ` · top ${ranking.countBestResults} contados`
                : ''}
            </span>
          )}
        </td>

        <td className="px-2 py-3.5 text-right">
          <span className={`font-semibold tabular-nums ${isTop3 ? 'text-warning text-base' : 'text-sm'}`}>
            {entry.totalPoints.toLocaleString('pt-BR')}
          </span>
        </td>

        <td className="px-3 py-3.5 w-10 text-center">
          {hasDetails && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailId}
              aria-label={`Detalhar pontos de ${names}`}
              onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <ChevronDown
                aria-hidden="true"
                className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </td>
      </tr>

      {open && hasDetails && (
        <tr>
          <td colSpan={4} className="p-0">
            <ResultsDetail
              id={detailId}
              athleteName={names}
              results={entry.resultsDetail}
              countBestResults={ranking.countBestResults}
              tournamentMap={tournamentMap}
            />
          </td>
        </tr>
      )}
    </Fragment>
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
  const [tab, setTab]           = useState<RankingTab>('entries')
  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [linking, setLinking]   = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving]     = useState(false)
  const PER_PAGE = 25

  useDocumentTitle(ranking ? `${ranking.name} · Rankings · Administração` : 'Ranking · Administração')

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
    apiFetch<RankingResponse>(`/rankings/${rankingId}/entries?page=${page}&pageSize=${PER_PAGE}`)
      .then(setData).finally(() => setLoading(false))
  }, [rankingId, page])

  useEffect(() => {
    apiFetch<Tournament[]>(`/rankings/${rankingId}/tournaments`).then((list) => {
      setLinkedTournaments(list)
      setTournamentMap(new Map(list.map((t) => [t.id, t.name])))
    })
  }, [rankingId])

  useEffect(() => {
    // Torneios vinculáveis: os 100 mais recentes do tenant
    apiFetch<Paginated<Tournament>>('/tournaments?pageSize=100').then(({ data: list }) => {
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
      const res = await apiFetch<RankingResponse>(`/rankings/${rankingId}/entries?page=1&pageSize=${PER_PAGE}`)
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
    <div role="status" aria-label="Carregando ranking" className="space-y-6 motion-safe:animate-pulse">
      <span className="sr-only">Carregando ranking…</span>
      <div className="h-8 w-32 rounded bg-muted" />
      <div className="h-24 rounded-xl bg-muted" />
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* EDIÇÃO */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Ranking</DialogTitle>
            <DialogDescription>Nome, descrição e regras de contagem de {ranking.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="grid gap-4">
            <Field label="Nome" required muted>
              {(props) => (
                <Input
                  {...props}
                  type="text" required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => f && ({ ...f, name: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Descrição" muted>
              {(props) => (
                <Input
                  {...props}
                  type="text" placeholder="Descrição opcional"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => f && ({ ...f, description: e.target.value }))}
                />
              )}
            </Field>

            <fieldset className="rounded-lg border border-border bg-muted/30 p-4">
              <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regras de contagem</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Melhores resultados" muted hint="Vazio = conta todos.">
                  {(props) => (
                    <Input
                      {...props}
                      type="number" min={1} max={99} placeholder="Todos (padrão)"
                      value={editForm.countBestResults}
                      onChange={(e) => setEditForm((f) => f && ({ ...f, countBestResults: e.target.value }))}
                    />
                  )}
                </Field>
                <Field label="Mínimo de torneios" muted hint="0 = sem restrição.">
                  {(props) => (
                    <Input
                      {...props}
                      type="number" min={0} max={99}
                      value={editForm.minTournamentsRequired}
                      onChange={(e) => setEditForm((f) => f && ({ ...f, minTournamentsRequired: e.target.value }))}
                    />
                  )}
                </Field>
              </div>
            </fieldset>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editForm.autoInclude}
                onChange={(e) => setEditForm((f) => f && ({ ...f, autoInclude: e.target.checked }))}
                className="size-4 rounded accent-primary"
              />
              <span className="text-sm">
                <span className="font-medium">Inclusão automática</span>
                <span className="text-muted-foreground ml-1.5">— todos os torneios com pontos distribuídos</span>
              </span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                <Save aria-hidden="true" />
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VOLTAR */}
      <button
        type="button"
        onClick={() => router.push('/admin/rankings')}
        className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        Voltar para Rankings
      </button>

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">{ranking.name}</h2>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium ${
              DISCIPLINE_PILL[ranking.discipline] ?? ''
            }`}>
              {isDoubles ? <Users className="w-3 h-3" aria-hidden="true" /> : <User className="w-3 h-3" aria-hidden="true" />}
              {disciplineLabel[ranking.discipline] ?? ranking.discipline}
            </span>
            {ranking.autoInclude && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-success/30 bg-success/10 text-success text-xs">
                <Zap className="w-3 h-3" aria-hidden="true" />
                Inclusão automática
              </span>
            )}
            {ranking.countBestResults && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning text-xs">
                <Trophy className="w-3 h-3" aria-hidden="true" />
                Top {ranking.countBestResults} torneios
              </span>
            )}
            {ranking.minTournamentsRequired > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border bg-muted text-muted-foreground text-xs">
                <Shield className="w-3 h-3" aria-hidden="true" />
                Mín. {ranking.minTournamentsRequired} torneios
              </span>
            )}
          </div>
          {ranking.description && <p className="text-sm text-muted-foreground">{ranking.description}</p>}
        </div>

        <div className="flex items-start gap-2 flex-wrap">
          <ExportCsvButton path={`/rankings/${ranking.id}/entries/export.csv`} fallbackName="ranking.csv" />
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            Editar
          </button>
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={recalcLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${recalcLoading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            {recalcLoading ? 'Recalculando...' : 'Recalcular'}
          </button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as RankingTab)}>
        <TabsList aria-label="Seções do ranking">
          <TabsTrigger value="entries">{`Classificação${data ? ` (${data.pagination.total})` : ''}`}</TabsTrigger>
          <TabsTrigger value="tournaments">{`Torneios (${linkedTournaments.length})`}</TabsTrigger>
          <TabsTrigger value="rules">Regras de Pontos</TabsTrigger>
        </TabsList>

        {/* TAB: ENTRIES */}
        <TabsContent value="entries">

          {/* Banner de regras ativas */}
          {(ranking.countBestResults || ranking.minTournamentsRequired > 0) && (
            <div className="rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-info flex flex-wrap items-center gap-x-4 gap-y-1">
              {ranking.countBestResults && (
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                  Contando os <strong>{ranking.countBestResults} melhores</strong> resultados por atleta
                </span>
              )}
              {ranking.minTournamentsRequired > 0 && (
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                  Mínimo de <strong>{ranking.minTournamentsRequired}</strong> torneio{ranking.minTournamentsRequired !== 1 ? 's' : ''} para participar
                </span>
              )}
              <span className="flex items-center gap-1.5 ml-auto text-info">
                Use o botão de cada linha para ver o detalhamento
              </span>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div role="status" aria-label="Carregando classificação">
                <span className="sr-only">Carregando classificação…</span>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[3rem_1fr_auto_2rem] gap-4 px-5 py-3.5 border-b border-border/50 motion-safe:animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-muted" />
                    <div className="h-3.5 w-40 bg-muted rounded self-center" />
                    <div className="h-4 w-16 bg-muted rounded self-center" />
                    <div />
                  </div>
                ))}
              </div>
            ) : !data?.data.length ? (
              <div className="p-12 text-center text-muted-foreground">
                <p className="font-medium">Nenhuma entrada ainda.</p>
                <p className="text-sm mt-1">Vincule torneios e clique em Recalcular.</p>
              </div>
            ) : (
              <div tabIndex={0} role="region" aria-label="Classificação do ranking" className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Classificação de {ranking.name}</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th scope="col" className="px-5 py-3 text-left">Posição</th>
                      <th scope="col" className="px-2 py-3 text-left">{isDoubles ? 'Dupla' : 'Atleta'}</th>
                      <th scope="col" className="px-2 py-3 text-right">Pontos</th>
                      <th scope="col" className="px-3 py-3"><span className="sr-only">Detalhes</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        isDoubles={isDoubles}
                        ranking={ranking}
                        tournamentMap={tournamentMap}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <nav aria-label="Paginação da classificação" className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, pagination.total)} de {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Página anterior" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-sm font-medium px-2">{page} / {pagination.totalPages}</span>
                <button type="button" aria-label="Próxima página" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </TabsContent>

        {/* TAB: TOURNAMENTS */}
        <TabsContent value="tournaments" className="space-y-6">
          {ranking.autoInclude && (
            <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success flex items-center gap-2">
              <Zap className="w-4 h-4 shrink-0" aria-hidden="true" />
              Este ranking usa inclusão automática — todos os torneios com pontos distribuídos são considerados ao recalcular.
              Os vínculos manuais abaixo são ignorados nesse modo.
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Torneios vinculados</h3>
            {unlinkable.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum torneio vinculado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {unlinkable.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.startDate).toLocaleDateString('pt-BR')} · {statusLabel[t.status] ?? t.status}
                        {t.pointsAwarded && ' · Pontos distribuídos'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlink(t.id)}
                      disabled={unlinking === t.id}
                      aria-label={`Desvincular ${t.name}`}
                      title="Desvincular torneio"
                      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {linkable.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Disponíveis para vincular</h3>
              <ul className="space-y-2">
                {linkable.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-muted-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.startDate).toLocaleDateString('pt-BR')} · {statusLabel[t.status] ?? t.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLink(t.id)}
                      disabled={linking === t.id}
                      aria-label={`Vincular ${t.name}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      {linking === t.id ? 'Vinculando...' : 'Vincular'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* TAB: REGRAS DE PONTOS */}
        <TabsContent value="rules">
          <div className="rounded-xl border border-border bg-card p-6">
            <PointRulesManager rankingId={rankingId} />
          </div>
        </TabsContent>
      </Tabs>

    </div>
  )
}
