'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { Pager } from '@/components/shared/pager'
import { CreateClubModal } from '@/components/club/create-club-modal'
import Link from 'next/link'
import { MapPin, Search, Plus } from 'lucide-react'
import { clubInkColor } from '@/lib/club-color'

type Club = {
  id: string; name: string; slug: string
  city: string | null; state: string | null
  logoUrl: string | null; coverUrl: string | null
  primaryColor: string | null; secondaryColor: string | null
  active: boolean
}

export function ClubsView() {
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const [page, setPage] = useState(1)
  const { data } = useQuery<Paginated<Club>>({
    queryKey: ['clubs', page],
    queryFn: () => apiFetch(`/clubs?page=${page}&pageSize=100`),
  })
  const clubs = data?.data ?? []

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
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar clube"
              placeholder="Buscar clube..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-lg border border-field-border bg-background pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo clube
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div role="status" className="text-center py-16 text-sm text-muted-foreground">
          {search ? `Nenhum clube encontrado para "${search}".` : 'Nenhum clube cadastrado ainda.'}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((club) => {
          const primary = club.primaryColor ?? '#6366f1'
          return (
            <Link
              key={club.id}
              href={`/admin/clubs/${club.id}`}
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
                    ? <Image unoptimized src={club.logoUrl} alt="" width={48} height={48} className="w-full h-full object-contain" />
                    : <span aria-hidden="true" className="text-lg font-bold" style={{ color: clubInkColor(primary) }}>{club.name.charAt(0)}</span>}
                </div>
              </div>
              <div className="pt-7 px-4 pb-4">
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">{club.name}</p>
                {(club.city || club.state) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" aria-hidden="true" />
                    {[club.city, club.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {data && <Pager pagination={data.pagination} onPageChange={setPage} />}

      <CreateClubModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
