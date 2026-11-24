'use client'

import Image from 'next/image'
import { use, useEffect, useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import { MapPin, Search, Users } from 'lucide-react'
import Link from 'next/link'
import { DISCIPLINE_PILL, genderAvatarClass } from '@/lib/discipline'
import { cn } from '@/lib/utils'
import { BackLink } from '@/components/public/back-link'
import { EmptyNotice } from '@/components/public/notices'
import { STAT_GRID, StatTile } from '@/components/public/stat-tile'
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
      <div className="space-y-3">
        <div className="h-11 w-20 rounded-sm bg-muted" />
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-8 w-56 max-w-full rounded-sm bg-muted" />
            <div className="h-4 w-40 rounded-sm bg-muted" />
          </div>
        </div>
      </div>
      <div className="h-20 rounded-lg bg-muted" />
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------
function NotFound() {
  return (
    <div className="space-y-3">
      <BackLink />
      <h1 className="font-heading text-3xl font-bold leading-tight">Clube não encontrado</h1>
      <p className="max-w-prose text-muted-foreground">
        O link que você acessou não corresponde a nenhum clube. Confira o endereço ou busque o clube pelo nome na página inicial.
      </p>
      <Link
        href="/#busca"
        className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground transition-colors hover:bg-primary-strong"
      >
        Buscar clubes e atletas
      </Link>
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

  const selectCls = 'h-(--control-h) rounded-md border border-field-border bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring cursor-pointer'

  return (
    <div className="space-y-8">

      <header className="space-y-3">
        <BackLink />
        {club.coverUrl && (
          // Capa enviada pelo clube; sem ela, nada de faixa decorativa.
          <div aria-hidden="true" className="h-32 w-full rounded-lg bg-muted bg-cover bg-center md:h-40" style={{ backgroundImage: `url(${club.coverUrl})` }} />
        )}
        <div className="flex items-center gap-4">
          {/* Fundo branco só sob o escudo enviado (logos são feitos para fundo claro); sem escudo, a inicial em névoa de quadra. */}
          <div className={cn('flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border', club.logoUrl ? 'bg-white' : 'bg-secondary')}>
            {club.logoUrl ? (
              <Image unoptimized src={club.logoUrl} alt={`Escudo de ${club.name}`} width={64} height={64} className="size-full object-contain p-1" />
            ) : (
              <span aria-hidden="true" className="font-heading text-3xl font-bold text-secondary-foreground">
                {club.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="break-words font-heading text-3xl font-bold leading-tight md:text-4xl">{club.name}</h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {(club.city || club.state) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" />
                  {[club.city, club.state].filter(Boolean).join(', ')}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="size-4 shrink-0" aria-hidden="true" />
                {roster.length} atleta{roster.length !== 1 ? 's' : ''}
              </span>
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="club-stats-title">
        <h2 id="club-stats-title" className="sr-only">Resumo</h2>
        <dl className={STAT_GRID}>
          <StatTile label="Pontos totais" value={totalPoints.toLocaleString('pt-BR')} hint="soma do plantel" />
          <StatTile label="Média por atleta" value={avgPoints.toLocaleString('pt-BR')} hint="pts / atleta" />
          <StatTile
            label="Ranking de clubes"
            value={rankAmongClubs ? `${rankAmongClubs}º` : '—'}
            hint={rankAmongClubs ? `de ${totalClubs} clubes` : 'sem dados'}
          />
          <StatTile
            label="Plantel ativo"
            value={roster.filter((a) => a.active).length}
            hint={`${roster.filter((a) => !a.active).length} inativo(s)`}
          />
        </dl>
      </section>

      {/* PLANTEL */}
      <section aria-labelledby="roster-title" className="space-y-3">
        <h2 id="roster-title" className="text-2xl">Plantel</h2>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar atleta do plantel"
              placeholder="Buscar atleta..."
              className="w-full h-(--control-h) rounded-md border border-field-border bg-background pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
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
          <div role="status">
            <EmptyNotice>
              <span className="block font-medium text-foreground">Nenhum atleta encontrado</span>
              {roster.length === 0 ? 'O clube ainda não tem atletas vinculados.' : 'Tente ajustar ou limpar os filtros.'}
            </EmptyNotice>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
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
                            <Link href={`/a/${athlete.id}`} className="inline-flex min-h-11 items-center rounded-sm font-medium hover:underline">
                              {athlete.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {athlete.gender === 'M' ? 'Masculino' : 'Feminino'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Total de pontos */}
                      <td className="px-4 py-3 text-center font-heading text-base font-bold tabular-nums">
                        {athlete.totalPoints.toLocaleString('pt-BR')}
                      </td>

                      {/* Por disciplina */}
                      {DISCIPLINES.map((d) => (
                        <td key={d} className="px-4 py-3 text-center tabular-nums">
                          {athlete.byDiscipline[d] ? (
                            <span className={cn('inline-flex h-5.5 items-center rounded-sm px-1.5 text-xs font-semibold', DISCIPLINE_PILL[d])}>
                              {athlete.byDiscipline[d].toLocaleString('pt-BR')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex h-5.5 items-center rounded-sm px-1.5 text-xs font-semibold', athlete.active ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground')}>
                          {athlete.active ? 'Ativo' : 'Inativo'}
                        </span>
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
      </section>
    </div>
  )
}
