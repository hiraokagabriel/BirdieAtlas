'use client'

import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { AthletesTable, type GenderFilter } from '@/components/athlete/athletes-table'
import { Pager } from '@/components/shared/pager'
import { ErrorNotice } from '@/components/public/notices'
import { CsvImportModal } from '@/components/athlete/csv-import-modal'
import { CreateAthleteModal } from '@/components/athlete/create-athlete-modal'
import { Upload, UserPlus } from 'lucide-react'

export type AthleteRow = {
  id: string
  name: string
  email: string | null
  gender: 'M' | 'F'
  birthDate: string | null
  nationality: string
  active: boolean
  clubId: string | null
  clubName: string | null
  affiliationStart: string | null
}

export default function AthletesPage() {
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  // Filtro novo sempre volta para a primeira página
  useEffect(() => { setPage(1) }, [debouncedSearch, genderFilter])

  const { data, isLoading, error } = useQuery<Paginated<AthleteRow>>({
    queryKey: ['athletes', 'admin', page, debouncedSearch, genderFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (genderFilter !== 'all') params.set('gender', genderFilter)
      return apiFetch(`/athletes?${params}`)
    },
    placeholderData: keepPreviousData,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Atletas</h2>
          <p className="text-muted-foreground">Gerencie os atletas filiados à federação.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Upload className="w-4 h-4" />
            Importar CSV
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Novo atleta
          </button>
        </div>
      </div>

      {error && !data ? (
        <ErrorNotice>Não foi possível carregar os atletas: {error.message}</ErrorNotice>
      ) : isLoading || !data ? (
        <div className="text-sm text-muted-foreground p-8">Carregando...</div>
      ) : (
        <>
          <AthletesTable
            athletes={data.data}
            total={data.pagination.total}
            search={search}
            onSearchChange={setSearch}
            genderFilter={genderFilter}
            onGenderFilterChange={setGenderFilter}
          />
          <Pager pagination={data.pagination} onPageChange={setPage} />
        </>
      )}

      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <CreateAthleteModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
