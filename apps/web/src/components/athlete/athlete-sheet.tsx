'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { AthleteRow } from '@/app/(dashboard)/athletes/page'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Calendar, Mail, MapPin } from 'lucide-react'

type Affiliation = {
  id: string
  clubId: string
  clubName: string
  city: string | null
  state: string | null
  startedAt: string
  endedAt: string | null
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function getAge(birthDate: string | null): string {
  if (!birthDate) return '—'
  const birth = new Date(birthDate)
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return `${age} anos`
}

const genderLabel = { M: 'Masculino', F: 'Feminino' }
const genderColor = { M: 'bg-blue-100 text-blue-700', F: 'bg-pink-100 text-pink-700' }

export function AthleteSheet({
  athlete,
  open,
  onClose,
}: {
  athlete: AthleteRow | null
  open: boolean
  onClose: () => void
}) {
  const { data: affiliations, isLoading } = useQuery({
    queryKey: ['affiliations', athlete?.id],
    queryFn: () => apiFetch<Affiliation[]>(`/athletes/${athlete!.id}/affiliations`),
    enabled: !!athlete?.id,
  })

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {athlete && (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">
                    {getInitials(athlete.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-xl">{athlete.name}</SheetTitle>
                  <SheetDescription className="mt-0.5">
                    {athlete.clubName ?? 'Sem clube'}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <Separator />

            {/* Info */}
            <div className="py-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className={genderColor[athlete.gender]}>
                    {genderLabel[athlete.gender]}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={athlete.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                  >
                    {athlete.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                {athlete.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {athlete.email}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {athlete.birthDate
                    ? `${new Date(athlete.birthDate).toLocaleDateString('pt-BR')} (${getAge(athlete.birthDate)})`
                    : 'Data de nascimento não informada'}
                </div>
              </div>
            </div>

            <Separator />

            {/* Affiliation history */}
            <div className="py-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico de Filiações</h3>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              ) : !affiliations?.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma filiação registrada.</p>
              ) : (
                <div className="space-y-2">
                  {affiliations
                    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                    .map((aff) => (
                      <div
                        key={aff.id}
                        className={`p-3 rounded-lg border ${
                          !aff.endedAt ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{aff.clubName}</p>
                              {(aff.city || aff.state) && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {[aff.city, aff.state].filter(Boolean).join('/')}
                                </p>
                              )}
                            </div>
                          </div>
                          {!aff.endedAt && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs shrink-0">Atual</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(aff.startedAt).toLocaleDateString('pt-BR')}
                          {aff.endedAt ? ` — ${new Date(aff.endedAt).toLocaleDateString('pt-BR')}` : ' — presente'}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
