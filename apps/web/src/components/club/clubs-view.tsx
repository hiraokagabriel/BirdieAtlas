'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { Pager } from '@/components/shared/pager'
import { CreateClubModal } from '@/components/club/create-club-modal'
import Link from 'next/link'
import { ChevronRight, Search, Plus } from 'lucide-react'
import { MapPin } from '@/components/icons/ba'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FIELD_CONTROL_CLASS } from '@/components/ui/field'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'
import { ROWS, ROW_LINK } from '@/components/public/rows'
import { Skeleton } from '@/components/ui/skeleton'

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
  const { data, isPending, isError, error } = useQuery<Paginated<Club>>({
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
          <h2 className="text-2xl">Clubes</h2>
          <p className="text-sm text-muted-foreground">Clubes filiados à federação.</p>
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
              className={cn(FIELD_CONTROL_CLASS, 'pl-9')}
            />
          </div>
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus aria-hidden="true" />
            Novo clube
          </Button>
        </div>
      </div>

      {isError ? (
        <ErrorNotice>Não foi possível carregar os clubes: {error instanceof Error ? error.message : 'erro inesperado'}.</ErrorNotice>
      ) : isPending ? (
        <div role="status" aria-busy="true" className="space-y-2">
          <span className="sr-only">Carregando clubes…</span>
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div role="status">
          <EmptyNotice>{search ? `Nenhum clube encontrado para "${search}".` : 'Nenhum clube cadastrado ainda. Cadastre o primeiro em "Novo clube".'}</EmptyNotice>
        </div>
      ) : (
        <ul className={ROWS}>
          {filtered.map((club) => (
            <li key={club.id}>
              <Link href={`/admin/clubs/${club.id}`} className={cn('flex min-h-14 items-center gap-3 px-4 py-2', ROW_LINK)}>
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
                  {club.logoUrl
                    ? <Image unoptimized src={club.logoUrl} alt="" width={40} height={40} className="size-full bg-white object-contain p-0.5" />
                    : <span aria-hidden="true" className="font-heading text-lg font-bold text-secondary-foreground">{club.name.charAt(0)}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold">{club.name}</span>
                  {(club.city || club.state) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" aria-hidden="true" />
                      {[club.city, club.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data && <Pager pagination={data.pagination} onPageChange={setPage} />}

      <CreateClubModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
