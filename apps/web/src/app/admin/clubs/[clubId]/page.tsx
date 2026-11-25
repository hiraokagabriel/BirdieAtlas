'use client'

import Image from 'next/image'
import { use, useCallback, useEffect, useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import { EditClubModal } from '@/components/club/edit-club-modal'
import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { Search, ExternalLink, ChevronLeft, Pencil, Globe } from 'lucide-react'
import { MapPin, Users } from '@/components/icons/ba'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { STAT_GRID, StatTile } from '@/components/public/stat-tile'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DISCIPLINE_PILL, genderAvatarClass } from '@/lib/discipline'
import { SortHeader } from '@/components/shared/sort-header'
import { useDocumentTitle } from '@/hooks/use-document-title'

type RosterAthlete = {
  id: string; name: string; gender: 'M' | 'F'
  photoUrl: string | null; active: boolean
  totalPoints: number
  byDiscipline: Record<string, number>
}

type ClubProfile = {
  club: {
    id: string; name: string; slug: string; city: string | null; state: string | null
    logoUrl: string | null; coverUrl: string | null
    primaryColor: string | null; secondaryColor: string | null
  }
  roster: RosterAthlete[]
  totalPoints: number
  avgPoints: number
  rankAmongClubs: number | null
  totalClubs: number
}

const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.',  WD: 'Duplas Fem.', XD: 'Misto',
}
const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'] as const
type SortField = 'name' | 'totalPoints' | 'MS' | 'WS' | 'MD' | 'WD' | 'XD'
type SortDir  = 'asc' | 'desc'

const selectCls = 'h-(--control-h) rounded-md border border-field-border bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring cursor-pointer'

export default function ClubProfilePage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = use(params)
  const router = useRouter()
  const [profile, setProfile] = useState<ClubProfile | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const [search, setSearch]               = useState('')
  const [genderFilter, setGender]         = useState<'all' | 'M' | 'F'>('all')
  const [disciplineFilter, setDiscipline] = useState<string>('all')
  const [activeFilter, setActive]         = useState<'all' | 'true' | 'false'>('all')
  const [sortField, setSortField]         = useState<SortField>('totalPoints')
  const [sortDir, setSortDir]             = useState<SortDir>('desc')

  const fetchProfile = useCallback(() => {
    apiFetch<ClubProfile>(`/clubs/${clubId}/profile`)
      .then(setProfile)
      .catch(() => setNotFound(true))
  }, [clubId])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const filtered = useMemo(() => {
    if (!profile) return []
    return profile.roster
      .filter((a) => {
        if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
        if (genderFilter !== 'all' && a.gender !== genderFilter) return false
        if (disciplineFilter !== 'all' && !(disciplineFilter in a.byDiscipline)) return false
        if (activeFilter !== 'all' && String(a.active) !== activeFilter) return false
        return true
      })
      .sort((a, b) => {
        const va = sortField === 'name' ? a.name : sortField === 'totalPoints' ? a.totalPoints : (a.byDiscipline[sortField] ?? 0)
        const vb = sortField === 'name' ? b.name : sortField === 'totalPoints' ? b.totalPoints : (b.byDiscipline[sortField] ?? 0)
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
        return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
      })
  }, [profile, search, genderFilter, disciplineFilter, activeFilter, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('desc') }
  }

  useDocumentTitle(profile ? `${profile.club.name} · Clubes · Administração` : 'Clube · Administração')

  if (notFound) return (
    <div className="space-y-4">
      <BackButton onClick={() => router.push('/admin/clubs')} />
      <div className="flex items-center justify-center h-64 text-muted-foreground">Clube não encontrado.</div>
    </div>
  )

  if (!profile) return (
    <div role="status" aria-label="Carregando clube" className="space-y-6 motion-safe:animate-pulse">
      <span className="sr-only">Carregando clube…</span>
      <div className="h-8 w-32 rounded-lg bg-muted" />
      <div className="h-52 rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}
      </div>
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  )

  const { club, roster, totalPoints, avgPoints, rankAmongClubs, totalClubs } = profile

  return (
    <div className="space-y-8">
      <BackButton onClick={() => router.push('/admin/clubs')} />

      <header className="space-y-4">
        {club.coverUrl && (
          // Capa enviada pelo clube; sem ela, nada de faixa decorativa.
          <div aria-hidden="true" className="h-32 w-full rounded-lg bg-muted bg-cover bg-center" style={{ backgroundImage: `url(${club.coverUrl})` }} />
        )}
        <div className="flex flex-wrap items-center gap-4">
          {/* Fundo branco só sob o escudo enviado; sem escudo, a inicial em névoa de quadra. */}
          <div className={cn('flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border', club.logoUrl ? 'bg-white' : 'bg-secondary')}>
            {club.logoUrl
              ? <Image unoptimized src={club.logoUrl} alt={`Escudo de ${club.name}`} width={64} height={64} className="size-full object-contain p-1" />
              : <span aria-hidden="true" className="font-heading text-3xl font-bold text-secondary-foreground">{club.name.charAt(0)}</span>}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="break-words text-2xl">{club.name}</h2>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {(club.city || club.state) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {[club.city, club.state].filter(Boolean).join(', ')}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="size-4" aria-hidden="true" />
                {roster.length} atleta{roster.length !== 1 ? 's' : ''}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/c/${club.slug}`} target="_blank" rel="noopener noreferrer">
                <Globe aria-hidden="true" />
                Ver perfil público
                <span className="sr-only"> (abre em nova aba)</span>
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden="true" />
              Editar clube
            </Button>
            <ExportCsvButton path={`/clubs/${club.id}/athletes/export.csv`} fallbackName="atletas-do-clube.csv" label="Exportar atletas" />
          </div>
        </div>
      </header>

      <section aria-labelledby="club-stats-title">
        <h3 id="club-stats-title" className="sr-only">Resumo</h3>
        <dl className={STAT_GRID}>
          <StatTile label="Pontos totais" value={totalPoints.toLocaleString('pt-BR')} hint="soma do plantel" />
          <StatTile label="Média por atleta" value={avgPoints.toLocaleString('pt-BR')} hint="pts / atleta" />
          <StatTile label="Ranking de clubes" value={rankAmongClubs ? `${rankAmongClubs}º` : '—'} hint={rankAmongClubs ? `de ${totalClubs} clubes` : 'sem dados'} />
          <StatTile label="Plantel ativo" value={roster.filter((a) => a.active).length} hint={`${roster.filter((a) => !a.active).length} inativo(s)`} />
        </dl>
      </section>

      {/* TABELA */}
      <div className="space-y-4">
        <h3 className="text-lg">Plantel</h3>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar atleta do plantel"
              placeholder="Buscar atleta..."
              className="w-full h-9 rounded-lg border border-field-border bg-background pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select aria-label="Filtrar por gênero" value={genderFilter} onChange={(e) => setGender(e.target.value as 'all' | 'M' | 'F')} className={selectCls}>
            <option value="all">Gênero: Todos</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
          <select aria-label="Filtrar por disciplina" value={disciplineFilter} onChange={(e) => setDiscipline(e.target.value)} className={selectCls}>
            <option value="all">Disciplina: Todas</option>
            {DISCIPLINES.map((d) => <option key={d} value={d}>{disciplineLabel[d]}</option>)}
          </select>
          <select aria-label="Filtrar por situação" value={activeFilter} onChange={(e) => setActive(e.target.value as 'all' | 'true' | 'false')} className={selectCls}>
            <option value="all">Status: Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Nenhum atleta encontrado com os filtros aplicados.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div tabIndex={0} role="region" aria-label="Plantel do clube" className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Plantel de {club.name}, com pontos por disciplina. Use os botões do cabeçalho para ordenar.</caption>
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th scope="col" className="text-left px-4 py-3 text-[0.8125rem] font-semibold text-muted-foreground  w-8">#</th>
                    <SortHeader label="Atleta" active={sortField === 'name'} direction={sortDir} onSort={() => toggleSort('name')} />
                    <SortHeader label="Total" active={sortField === 'totalPoints'} direction={sortDir} onSort={() => toggleSort('totalPoints')} className="text-center" />
                    {DISCIPLINES.map((d) => (
                      <SortHeader key={d} label={d} active={sortField === d} direction={sortDir} onSort={() => toggleSort(d)} className="text-center" />
                    ))}
                    <th scope="col" className="px-4 py-3 text-left text-[0.8125rem] font-semibold text-muted-foreground ">Status</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Perfil público</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((athlete, i) => (
                    <tr key={athlete.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div aria-hidden="true" className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${genderAvatarClass(athlete.gender)}`}>
                            {athlete.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{athlete.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {athlete.gender === 'M' ? 'Masculino' : 'Feminino'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-heading text-base font-bold tabular-nums">
                        {athlete.totalPoints.toLocaleString('pt-BR')}
                      </td>
                      {DISCIPLINES.map((d) => (
                        <td key={d} className="px-4 py-3 text-center tabular-nums">
                          {athlete.byDiscipline[d] ? (
                            <span className={`inline-block px-2 py-0.5 rounded-sm border text-xs font-medium ${DISCIPLINE_PILL[d]}`}>
                              {athlete.byDiscipline[d].toLocaleString('pt-BR')}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${
                          athlete.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                        }`}>
                          {athlete.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/a/${athlete.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ver página pública de ${athlete.name} (abre em nova aba)`}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-primary"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              {filtered.length} de {roster.length} atleta{roster.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      <EditClubModal
        club={club}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={fetchProfile}
      />
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-(--control-h) items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      Voltar para Clubes
    </button>
  )
}
