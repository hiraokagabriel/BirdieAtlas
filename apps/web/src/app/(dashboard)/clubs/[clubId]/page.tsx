'use client'

import { use, useEffect, useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import { MapPin, Trophy, TrendingUp, Users, Search, ArrowUpDown, ChevronUp, ChevronDown, ExternalLink, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type RosterAthlete = {
  id: string; name: string; gender: 'M' | 'F'
  birthDate: string | null; photoUrl: string | null; active: boolean
  totalPoints: number
  byDiscipline: Record<string, number>
}

type ClubProfile = {
  club: {
    id: string; name: string; city: string | null; state: string | null
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
const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-500/10 text-blue-700 border-blue-200',
  WS: 'bg-purple-500/10 text-purple-700 border-purple-200',
  MD: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
  WD: 'bg-pink-500/10 text-pink-700 border-pink-200',
  XD: 'bg-orange-500/10 text-orange-700 border-orange-200',
}

const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'] as const
type SortField = 'name' | 'totalPoints' | 'MS' | 'WS' | 'MD' | 'WD' | 'XD'
type SortDir  = 'asc' | 'desc'

const selectCls = 'h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer'

function StatCard({ label, value, sub, icon: Icon, primary }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; primary: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card/80 backdrop-blur p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" style={{ color: primary }} />
        {label}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export default function ClubProfilePage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = use(params)
  const router = useRouter()
  const [profile, setProfile] = useState<ClubProfile | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [search, setSearch]             = useState('')
  const [genderFilter, setGender]       = useState<'all' | 'M' | 'F'>('all')
  const [disciplineFilter, setDiscipline] = useState<string>('all')
  const [activeFilter, setActive]       = useState<'all' | 'true' | 'false'>('all')
  const [sortField, setSortField]       = useState<SortField>('totalPoints')
  const [sortDir, setSortDir]           = useState<SortDir>('desc')

  useEffect(() => {
    apiFetch<ClubProfile>(`/clubs/${clubId}/profile`)
      .then(setProfile)
      .catch(() => setNotFound(true))
  }, [clubId])

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

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1" />
      : <ChevronDown className="w-3 h-3 ml-1" />
  }

  if (notFound) return (
    <div className="space-y-4">
      <BackButton onClick={() => router.push('/clubs')} />
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Clube não encontrado.
      </div>
    </div>
  )

  if (!profile) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 rounded-lg bg-muted" />
      <div className="h-52 rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}
      </div>
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  )

  const { club, roster, totalPoints, avgPoints, rankAmongClubs, totalClubs } = profile
  const primary   = club.primaryColor   ?? '#6366f1'
  const secondary = club.secondaryColor ?? primary

  return (
    <div className="space-y-8">

      {/* VOLTAR */}
      <BackButton onClick={() => router.push('/clubs')} />

      {/* HERO */}
      <div className="rounded-2xl overflow-hidden border border-border">
        <div
          className="h-40 w-full"
          style={{
            background: club.coverUrl
              ? `url(${club.coverUrl}) center/cover no-repeat`
              : `linear-gradient(135deg, ${primary}, ${secondary})`,
          }}
        />
        <div className="px-6 pb-6 pt-0 bg-card">
          <div className="flex items-end gap-5 -mt-10">
            <div className="w-20 h-20 rounded-2xl border-4 border-background shadow-lg flex items-center justify-center overflow-hidden shrink-0 bg-white">
              {club.logoUrl
                ? <img src={club.logoUrl} alt={club.name} className="w-full h-full object-contain p-1" />
                : <span className="text-3xl font-black" style={{ color: primary }}>{club.name.charAt(0)}</span>}
            </div>
            <div className="pb-1 flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap mt-0.5">
                {(club.city || club.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {[club.city, club.state].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className="flex items-center gap-1">
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
        <StatCard label="Pontos totais"     value={totalPoints.toLocaleString('pt-BR')}       sub="soma do plantel"   icon={TrendingUp} primary={primary} />
        <StatCard label="Média por atleta"  value={avgPoints.toLocaleString('pt-BR')}         sub="pts / atleta"      icon={TrendingUp} primary={primary} />
        <StatCard label="Ranking de clubes" value={rankAmongClubs ? `${rankAmongClubs}º` : '—'} sub={rankAmongClubs ? `de ${totalClubs} clubes` : 'sem dados'} icon={Trophy} primary={primary} />
        <StatCard label="Plantel ativo"     value={roster.filter((a) => a.active).length}     sub={`${roster.filter((a) => !a.active).length} inativo(s)`} icon={Users} primary={primary} />
      </div>

      {/* TABELA */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: primary }} />
          Plantel
        </h2>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar atleta..."
              className="w-full h-9 rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={genderFilter} onChange={(e) => setGender(e.target.value as 'all' | 'M' | 'F')} className={selectCls}>
            <option value="all">Gênero: Todos</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
          <select value={disciplineFilter} onChange={(e) => setDiscipline(e.target.value)} className={selectCls}>
            <option value="all">Disciplina: Todas</option>
            {DISCIPLINES.map((d) => <option key={d} value={d}>{disciplineLabel[d]}</option>)}
          </select>
          <select value={activeFilter} onChange={(e) => setActive(e.target.value as 'all' | 'true' | 'false')} className={selectCls}>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-4 py-3">
                      <button className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground" onClick={() => toggleSort('name')}>
                        Atleta <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground" onClick={() => toggleSort('totalPoints')}>
                        Total <SortIcon field="totalPoints" />
                      </button>
                    </th>
                    {DISCIPLINES.map((d) => (
                      <th key={d} className="px-4 py-3">
                        <button className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground" onClick={() => toggleSort(d)}>
                          {d} <SortIcon field={d} />
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((athlete, i) => (
                    <tr key={athlete.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: athlete.gender === 'M' ? '#3b82f6' : '#ec4899' }}
                          >
                            {athlete.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{athlete.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {athlete.gender === 'M' ? 'Masculino' : 'Feminino'}
                              {athlete.birthDate ? ` · ${new Date(athlete.birthDate).getFullYear()}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums" style={{ color: primary }}>
                        {athlete.totalPoints.toLocaleString('pt-BR')}
                      </td>
                      {DISCIPLINES.map((d) => (
                        <td key={d} className="px-4 py-3 text-center tabular-nums">
                          {athlete.byDiscipline[d] ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${disciplineColors[d]}`}>
                              {athlete.byDiscipline[d].toLocaleString('pt-BR')}
                            </span>
                          ) : <span className="text-border">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          athlete.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {athlete.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/a/${athlete.id}`} target="_blank" className="text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
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
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ChevronLeft className="w-4 h-4" />
      Voltar para Clubes
    </button>
  )
}
