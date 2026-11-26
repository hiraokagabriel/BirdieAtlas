'use client'

import { formatDate } from '@/lib/format'
import { useState } from 'react'
import type { AthleteRow } from './athletes-view'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AthleteSheet } from './athlete-sheet'
import { Search } from 'lucide-react'
import { Users } from '@/components/icons/ba'
import { ageFromBirthYear } from '@/lib/birth-year'

const genderLabel = { M: 'Masculino', F: 'Feminino' }

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export type GenderFilter = 'all' | 'M' | 'F'

const GENDER_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'M', label: genderLabel.M },
  { value: 'F', label: genderLabel.F },
] as const

interface AthletesTableProps {
  athletes: AthleteRow[]
  total: number
  search: string
  onSearchChange: (value: string) => void
  genderFilter: GenderFilter
  onGenderFilterChange: (value: GenderFilter) => void
}

// Busca e filtro rodam no servidor: a tabela só mostra a página recebida.
export function AthletesTable({
  athletes: filtered, total, search, onSearchChange, genderFilter, onGenderFilterChange,
}: AthletesTableProps) {
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteRow | null>(null)
  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Buscar atletas por nome"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <ChoiceGroup
          legend="Filtrar por gênero"
          hideLegend
          options={GENDER_FILTERS}
          value={genderFilter}
          onChange={onGenderFilterChange}
          optionClassName="px-3 py-1 text-xs font-semibold"
        />
        <div role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground ml-auto">
          <Users className="w-4 h-4" aria-hidden="true" />
          <span>{total} atleta{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table label="Lista de atletas">
          <caption className="sr-only">Atletas filiados à federação. Ative o nome para abrir os detalhes.</caption>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Atleta</TableHead>
              <TableHead>Gênero</TableHead>
              <TableHead className="hidden md:table-cell">Idade</TableHead>
              <TableHead>Clube atual</TableHead>
              <TableHead className="hidden md:table-cell">Filiado desde</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhum atleta encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((athlete) => (
                <TableRow
                  key={athlete.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedAthlete(athlete)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                          {getInitials(athlete.name)}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={(event) => { event.stopPropagation(); setSelectedAthlete(athlete) }}
                        className="min-h-6 rounded-sm text-left outline-offset-4"
                      >
                        <span className="block font-medium text-sm">{athlete.name}</span>
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                      {genderLabel[athlete.gender]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{ageFromBirthYear(athlete.birthYear)}</TableCell>
                  <TableCell>
                    {athlete.clubName ? (
                      <span className="text-sm font-medium">{athlete.clubName}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sem clube</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {athlete.affiliationStart
                      ? formatDate(athlete.affiliationStart)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={athlete.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}
                    >
                      {athlete.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Profile sheet */}
      <AthleteSheet
        athlete={selectedAthlete}
        open={!!selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
      />
    </>
  )
}
