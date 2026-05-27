import { apiFetch } from '@/lib/api'
import Link from 'next/link'
import { MapPin, Users } from 'lucide-react'

type Club = {
  id: string; name: string; slug: string
  city: string | null; state: string | null
  logoUrl: string | null; coverUrl: string | null
  primaryColor: string | null; secondaryColor: string | null
  active: boolean
}

export default async function ClubsPage() {
  const clubs = await apiFetch<Club[]>('/clubs')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Clubes</h2>
        <p className="text-muted-foreground">Clubes filiados à federação.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {clubs.map((club) => {
          const primary = club.primaryColor ?? '#6366f1'
          return (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              className="group rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow bg-card"
            >
              {/* Capa */}
              <div
                className="h-20 w-full relative"
                style={{
                  background: club.coverUrl
                    ? `url(${club.coverUrl}) center/cover no-repeat`
                    : `linear-gradient(135deg, ${primary}cc, ${club.secondaryColor ?? primary}66)`,
                }}
              >
                {/* Logo sobre a capa */}
                <div className="absolute -bottom-5 left-4 w-12 h-12 rounded-full border-2 border-background bg-background flex items-center justify-center overflow-hidden shadow">
                  {club.logoUrl
                    ? <img src={club.logoUrl} alt={club.name} className="w-full h-full object-contain" />
                    : <span className="text-lg font-bold" style={{ color: primary }}>{club.name.charAt(0)}</span>}
                </div>
              </div>

              <div className="pt-7 px-4 pb-4">
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">{club.name}</p>
                {(club.city || club.state) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {[club.city, club.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
