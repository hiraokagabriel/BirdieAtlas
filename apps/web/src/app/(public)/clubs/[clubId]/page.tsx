'use client'

import { use, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { MapPin, Users, User, Award, Shield } from 'lucide-react'

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
  active: boolean
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

type ProfileData = {
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

const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-50 text-blue-700 border-blue-200',
  WS: 'bg-purple-50 text-purple-700 border-purple-200',
  MD: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  WD: 'bg-pink-50 text-pink-700 border-pink-200',
  XD: 'bg-orange-50 text-orange-700 border-orange-200',
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function PageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-muted shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-7 w-56 bg-muted rounded" />
            <div className="h-4 w-36 bg-muted rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-7 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card h-64" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <Shield className="w-12 h-12 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold">Clube não encontrado</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        O link que você acessou não corresponde a nenhum clube. Verifique se o endereço está correto.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-0.5">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function PublicClubPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = use(params)

  const [profile, setProfile]   = useState<ProfileData | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    apiFetch<ProfileData>(`/clubs/${clubId}/profile`)
      .then(setProfile)
      .catch(() => setNotFound(true))
  }, [clubId])

  if (notFound)  return <NotFound />
  if (!profile)  return <PageSkeleton />

  const { club, roster, totalPoints, avgPoints, rankAmongClubs, totalClubs } = profile

  const primaryColor   = club.primaryColor   ?? undefined
  const secondaryColor = club.secondaryColor ?? undefined

  return (
    <div className="space-y-8">

      {/* HERO */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Cover */}
        {club.coverUrl && (
          <div className="h-32 md:h-44 w-full overflow-hidden">
            <img
              src={club.coverUrl}
              alt=""
              width={1200}
              height={176}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6 md:p-8">
          <div className="flex items-start gap-5 flex-wrap">
            {/* Logo */}
            {club.logoUrl ? (
              <img
                src={club.logoUrl}
                alt={club.name}
                width={80}
                height={80}
                className="w-20 h-20 rounded-2xl object-contain border border-border bg-muted shrink-0"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 border border-border"
                style={{
                  backgroundColor: primaryColor ? `${primaryColor}22` : undefined,
                  borderColor: primaryColor ?? undefined,
                }}
              >
                <span
                  className="text-2xl font-bold select-none"
                  style={{ color: primaryColor ?? 'var(--muted-foreground)' }}
                >
                  {initials(club.name)}
                </span>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
                {!club.active && (
                  <span className="text-xs font-medium text-muted-foreground border border-border rounded-full px-2 py-0.5">
                    Inativo
                  </span>
                )}
              </div>

              {(club.city || club.state) && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {club.city}{club.state ? `, ${club.state}` : ''}
                </p>
              )}

              {/* Cores do clube */}
              {(primaryColor || secondaryColor) && (
                <div className="flex items-center gap-2 pt-0.5">
                  {primaryColor && (
                    <span
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: primaryColor }}
                      title={`Cor primária: ${primaryColor}`}
                    />
                  )}
                  {secondaryColor && (
                    <span
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: secondaryColor }}
                      title={`Cor secundária: ${secondaryColor}`}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Atletas"
          value={roster.length}
          sub={roster.length !== 1 ? 'no elenco' : 'no elenco'}
        />
        <StatCard
          label="Total de pontos"
          value={totalPoints.toLocaleString('pt-BR')}
          sub={`média ${avgPoints.toLocaleString('pt-BR')} / atleta`}
        />
        <StatCard
          label="Ranking de clubes"
          value={rankAmongClubs !== null ? `${rankAmongClubs}º` : '—'}
          sub={rankAmongClubs !== null ? `de ${totalClubs} clubes` : 'sem dados'}
        />
      </div>

      {/* ELENCO */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Elenco atual — {roster.length} atleta{roster.length !== 1 ? 's' : ''}
        </h2>

        {roster.length === 0 ? (
          <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Users className="w-8 h-8 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">Nenhum atleta no elenco</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Este clube ainda não possui atletas com afiliação ativa.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {roster.map((athlete) => (
              <div key={athlete.id} className="flex items-center gap-4 px-4 py-3 flex-wrap">
                {/* Avatar */}
                {athlete.photoUrl ? (
                  <img
                    src={athlete.photoUrl}
                    alt={athlete.name}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
                    <span className="text-xs font-bold text-muted-foreground select-none">
                      {initials(athlete.name)}
                    </span>
                  </div>
                )}

                {/* Nome + gênero */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{athlete.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {athlete.gender === 'M'
                      ? <><User className="w-3 h-3" /> Masculino</>
                      : <><User className="w-3 h-3" /> Feminino</>}
                  </p>
                </div>

                {/* Pontos por disciplina */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {Object.entries(athlete.byDiscipline)
                    .sort((a, b) => b[1] - a[1])
                    .map(([disc, pts]) => (
                      <span
                        key={disc}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                          disciplineColors[disc] ?? 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {disciplineLabel[disc] ?? disc}: {pts.toLocaleString('pt-BR')}
                      </span>
                    ))}
                  {athlete.totalPoints > 0 && (
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {athlete.totalPoints.toLocaleString('pt-BR')} pts
                    </span>
                  )}
                  {athlete.totalPoints === 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Award className="w-3 h-3" /> Sem pontos
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
