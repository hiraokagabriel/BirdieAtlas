import { apiFetch } from '@/lib/api'
import { AthletesTable } from '@/components/athlete/athletes-table'

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

export default async function AthletesPage() {
  const athletes = await apiFetch<AthleteRow[]>('/athletes/with-club')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Atletas</h2>
        <p className="text-muted-foreground">Gerencie os atletas filiados à federação.</p>
      </div>
      <AthletesTable athletes={athletes} />
    </div>
  )
}
