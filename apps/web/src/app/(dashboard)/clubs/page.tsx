'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { CreateClubModal } from '@/components/club/create-club-modal'
import Link from 'next/link'
import { MapPin, Search, Plus } from 'lucide-react'

type Club = {
  id: string; name: string; slug: string
  city: string | null; state: string | null
  logoUrl: string | null; coverUrl: string | null
  primaryColor: string | null; secondaryColor: string | null
  active: boolean
}

export default function ClubsPage() {
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const { data: clubs = [] } = useQuery<Club[]>({
    queryKey: ['clubs'],
    queryFn: () => apiFetch('/clubs'),
  })

  const filtered = clubs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.state ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clubes</h2>
          <p className="text-muted-foreground">Clubes filiados à federação.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar clube..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo clube
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground">
          {search ? `Nenhum clube encontrado para "${search}".` : 'Nenhum clube cadastrado ainda.'}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((club) => {
          const primary = club.primaryColor ?? '#6366f1'
          return (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              className="group rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow bg-card"
            >
              <div
                className="h-20 w-full relative"
                style={{
                  background: club.coverUrl
                    ? `url(${club.coverUrl}) center/cover no-repeat`
                    : `linear-gradient(135deg, ${primary}cc, ${club.secondaryColor ?? primary}66)`,
                }}
              >
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

      <CreateClubModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
