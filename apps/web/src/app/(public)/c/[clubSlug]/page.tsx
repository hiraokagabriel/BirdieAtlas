'use client'

import Image from 'next/image'
import { use, useEffect, useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import {
  MapPin, Users, TrendingUp, Trophy,
  Search, ExternalLink, User,
} from 'lucide-react'
import Link from 'next/link'
import { DISCIPLINE_PILL, genderAvatarClass } from '@/lib/discipline'
import { clubInkColor, clubInkOnWhite } from '@/lib/club-color'
import { SortHeader } from '@/components/shared/sort-header'
import { useDocumentTitle } from '@/hooks/use-document-title'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Club = {
  id: string
  name: string
  slug: string
  city: string | null
  state: string | null
  logoUrl: string | null
  coverUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
}

type RosterAthlete = {
  id: string
  name: string
  gender: 'M' | 'F'
  nationality: string
  photoUrl: string | null
  active: boolean
  totalPoints: number
  byDiscipline: Record<string, number>
}

type ClubProfile = {
  club: Club
  roster: RosterAthlete[]
  totalPoints: number
  avgPoints: number
  rankAmongClubs: number | null
  totalClubs: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.',  WD: 'Duplas Fem.', XD: 'Misto',
}

const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'] as const
type SortField = 'name' | 'totalPoints' | 'MS' | 'WS' | 'MD' | 'WD' | 'XD'
type SortDir   = 'asc' | 'desc'

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-8 motion-safe:animate-pulse">
      <span className="sr-only">Carregando clube…</span>
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="h-40 bg-muted" />
        <div className="bg-card px-6 pb-6 pt-0">
          <div className="flex items-end gap-5 -mt-10">
            <div className="w-20 h-20 rounded-2xl bg-muted border-4 border-background shrink-0" />
            <div className="pb-1 space-y-2 flex-1">
              <div className="h-7 w-48 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-14 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <Users className="w-12 h-12 text-muted-foreground/40" />
      <h1 className="text-xl font-semibold">Clube não encontrado</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        O link que você acessou não corresponde a nenhum clube. Verifique se o endereço está correto.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
function StatCard({
  label, value, sub, icon: Icon, accentColor,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accentColor: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <Icon className="w-3.5 h-3.5" style={{ color: clubInkColor(accentColor) }} aria-hidden="true" />
        {label}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function PublicClubPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params)

  const [profile, setProfile]   = useState<ClubProfile | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [search, setSearch]               = useState('')
  const [genderFilter, setGender]         = useState<'all' | 'M' | 'F'>('all')
  const [disciplineFilter, setDiscipline] = useState<string>('all')
  const [activeFilter, setActive]         = useState<'all' | 'true' | 'false'>('all')
  const [sortField, setSortField]         = useState<SortField>('totalPoints')
  const [sortDir, setSortDir]             = useState<SortDir>('desc')

  useDocumentTitle(profile ? `${profile.club.name} · Clube` : 'Clube')

  useEffect(() => {
    apiFetch<Club>(`/clubs/by-slug/${clubSlug}`)
      .then((club) => apiFetch<ClubProfile>(`/clubs/${club.id}/profile`))
      .then(setProfile)
      .catch(() => setNotFound(true))
  }, [clubSlug])

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
        const va = sortField === 'name' ? a.name
          : sortField === 'totalPoints' ? a.totalPoints
          : (a.byDiscipline[sortField] ?? 0)
        const vb = sortField === 'name' ? b.name
          : sortField === 'totalPoints' ? b.totalPoints
          : (b.byDiscipline[sortField] ?? 0)
        if (typeof va === 'string') {
          return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
        }
        return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
      })
  }, [profile, search, genderFilter, disciplineFilter, activeFilter, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('desc') }
  }

  if (notFound)  return <NotFound />
  if (!profile)  return <PageSkeleton />

  const { club, roster, totalPoints, avgPoints, rankAmongClubs, totalClubs } = profile
  const primary   = club.primaryColor   ?? '#01696f'
  const secondary = club.secondaryColor ?? primary

  const selectCls = 'h-9 rounded-lg border border-field-border bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring cursor-pointer'

  return (
    <div className="space-y-8">

      {/* HERO */}
      <div className="rounded-2xl overflow-hidden border border-border">
        {/* Cover */}
        <div
          className="h-40 w-full"
          style={{
            background: club.coverUrl
              ? `url(${club.coverUrl}) center/cover no-repeat`
              : `linear-gradient(135deg, ${primary}, ${secondary})`,
          }}
        />

        {/* Info */}
        <div className="px-6 pb-6 pt-0 bg-card">
          <div className="flex items-end gap-5 flex-wrap -mt-10">
            {/* Logo */}
            <div
              className="w-20 h-20 rounded-2xl border-4 border-background shadow-lg flex items-center justify-center overflow-hidden shrink-0 bg-white"
            >
              {club.logoUrl ? (
                <Image
                  unoptimized
                  src={club.logoUrl}
                  alt={club.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <span aria-hidden="true" className="text-3xl font-black" style={{ color: clubInkOnWhite(primary) }}>
                  {club.name.charAt(0)}
                </span>
              )}
            </div>

            {/* Nome + localização */}
            <div className="pb-1 flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap mt-0.5">
                {(club.city || club.state) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {[club.city, club.state].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {roster.length} atleta{roster.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Pontos totais"
          value={totalPoints.toLocaleString('pt-BR')}
          sub="soma do plantel"
          icon={TrendingUp}
          accentColor={primary}
        />
        <StatCard
          label="Média por atleta"
          value={avgPoints.toLocaleString('pt-BR')}
          sub="pts / atleta"
          icon={TrendingUp}
          accentColor={primary}
        />
        <StatCard
          label="Ranking de clubes"
          value={rankAmongClubs ? `${rankAmongClubs}º` : '—'}
          sub={rankAmongClubs ? `de ${totalClubs} clubes` : 'sem dados'}
          icon={Trophy}
          accentColor={primary}
        />
        <StatCard
          label="Plantel ativo"
          value={roster.filter((a) => a.active).length}
          sub={`${roster.filter((a) => !a.active).length} inativo(s)`}
          icon={Users}
          accentColor={primary}
        />
      </div>

      {/* PLANTEL */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: clubInkColor(primary) }} />
          Plantel
        </h2>

        {/* Filtros */}
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

        {/* Tabela */}
        {filtered.length === 0 ? (
          <div role="status" className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 gap-3 text-center">
            <User className="w-8 h-8 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Nenhum atleta encontrado</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Tente ajustar os filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div tabIndex={0} role="region" aria-label="Plantel do clube" className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Plantel de {club.name}, com pontos por disciplina. Use os botões do cabeçalho para ordenar.</caption>
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8">#</th>
                    <SortHeader label="Atleta" active={sortField === 'name'} direction={sortDir} onSort={() => toggleSort('name')} />
                    <SortHeader label="Total" active={sortField === 'totalPoints'} direction={sortDir} onSort={() => toggleSort('totalPoints')} className="text-center" />
                    {DISCIPLINES.map((d) => (
                      <SortHeader key={d} label={d} active={sortField === d} direction={sortDir} onSort={() => toggleSort(d)} className="text-center" />
                    ))}
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Perfil do atleta</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((athlete, i) => (
                    <tr
                      key={athlete.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">{i + 1}</td>

                      {/* Atleta */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {athlete.photoUrl ? (
                            <Image
                              unoptimized
                              src={athlete.photoUrl}
                              alt=""
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div
                              aria-hidden="true"
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${genderAvatarClass(athlete.gender)}`}
                            >
                              {initials(athlete.name)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{athlete.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {athlete.gender === 'M' ? 'Masculino' : 'Feminino'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Total de pontos */}
                      <td className="px-4 py-3 font-bold tabular-nums" style={{ color: clubInkColor(primary) }}>
                        {athlete.totalPoints.toLocaleString('pt-BR')}
                      </td>

                      {/* Por disciplina */}
                      {DISCIPLINES.map((d) => (
                        <td key={d} className="px-4 py-3 text-center tabular-nums">
                          {athlete.byDiscipline[d] ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${
                              DISCIPLINE_PILL[d]
                            }`}>
                              {athlete.byDiscipline[d].toLocaleString('pt-BR')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          athlete.active
                            ? 'bg-success/10 text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {athlete.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Link perfil */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/a/${athlete.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ver perfil de ${athlete.name} (abre em nova aba)`}
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

            {/* Footer da tabela */}
            <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              {filtered.length} de {roster.length} atleta{roster.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
