'use client'

import { useState } from 'react'
import type { AthleteRow } from '@/app/admin/athletes/page'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AthleteSheet } from './athlete-sheet'
import { Search, Users } from 'lucide-react'
import { GENDER_PILL } from '@/lib/discipline'

const genderLabel = { M: 'Masculino', F: 'Feminino' }

function getAge(birthDate: string | null): string {
  if (!birthDate) return '—'
  const birth = new Date(birthDate)
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return `${age} anos`
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export type GenderFilter = 'all' | 'M' | 'F'

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {(['all', 'M', 'F'] as const).map((g) => (
            <button
              key={g}
              onClick={() => onGenderFilterChange(g)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                genderFilter === g
                  ? 'bg-card text-card-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {g === 'all' ? 'Todos' : genderLabel[g]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-auto">
          <Users className="w-4 h-4" />
          <span>{total} atleta{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Atleta</TableHead>
              <TableHead>Gênero</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Clube atual</TableHead>
              <TableHead>Filiado desde</TableHead>
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
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedAthlete(athlete)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                          {getInitials(athlete.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{athlete.name}</p>
                        {athlete.email && <p className="text-xs text-muted-foreground">{athlete.email}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={GENDER_PILL[athlete.gender]}>
                      {genderLabel[athlete.gender]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getAge(athlete.birthDate)}</TableCell>
                  <TableCell>
                    {athlete.clubName ? (
                      <span className="text-sm font-medium">{athlete.clubName}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sem clube</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {athlete.affiliationStart
                      ? new Date(athlete.affiliationStart).toLocaleDateString('pt-BR')
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
