'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { AthletesTable } from '@/components/athlete/athletes-table'
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

  const { data: athletes = [], isLoading } = useQuery<AthleteRow[]>({
    queryKey: ['athletes'],
    queryFn: () => apiFetch('/athletes/with-club'),
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

      {isLoading ? (
        <div className="text-sm text-muted-foreground p-8">Carregando...</div>
      ) : (
        <AthletesTable athletes={athletes} />
      )}

      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <CreateAthleteModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
