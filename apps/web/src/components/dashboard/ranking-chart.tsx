'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'

type Category = 'MS' | 'WS' | 'MD' | 'WD' | 'XD'

type RankingMeta = {
  id: string
  discipline: string
  name: string
  year: number
}

type RankingEntry = {
  id: string
  position: number
  totalPoints: number
  athlete: { id: string; name: string } | null
  athlete2: { id: string; name: string } | null
}

type EntriesResponse = Paginated<RankingEntry> & { ranking: RankingMeta }

const categoryConfig: Record<Category, { color: string; label: string }> = {
  MS: { color: '#3b82f6', label: 'Simples Masculino' },
  WS: { color: '#a855f7', label: 'Simples Feminino' },
  MD: { color: '#06b6d4', label: 'Duplas Masculino' },
  WD: { color: '#ec4899', label: 'Duplas Feminino' },
  XD: { color: '#f97316', label: 'Duplas Misto' },
}

const CATEGORIES: Category[] = ['MS', 'WS', 'MD', 'WD', 'XD']

function shortName(entry: RankingEntry): string {
  const firstName = (name: string) => name.split(' ')[0]
  if (entry.athlete && entry.athlete2) {
    return `${firstName(entry.athlete.name)} / ${firstName(entry.athlete2.name)}`
  }
  return entry.athlete?.name ?? '—'
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { payload: { name: string }; value: number; fill: string }[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-popover-foreground">{entry.payload.name}</p>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium" style={{ color: entry.fill }}>{entry.value}</span>{' pts'}
      </p>
    </div>
  )
}

export function RankingChart() {
  const [active, setActive] = useState<Category>('MS')
  const [rankingMap, setRankingMap] = useState<Partial<Record<Category, string>>>({})
  const [data, setData] = useState<{ name: string; points: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Rankings do tenant padrão, mais recentes primeiro: fica o primeiro de cada disciplina
    apiFetch<Paginated<RankingMeta>>('/rankings?pageSize=100').then(({ data: list }) => {
      const map: Partial<Record<Category, string>> = {}
      for (const r of list) {
        if (CATEGORIES.includes(r.discipline as Category) && !map[r.discipline as Category]) {
          map[r.discipline as Category] = r.id
        }
      }
      setRankingMap(map)
    }).catch(() => null)
  }, [])

  useEffect(() => {
    const id = rankingMap[active]
    if (!id) { setData([]); setLoading(false); return }
    setLoading(true)
    apiFetch<EntriesResponse>(`/rankings/${id}/entries?pageSize=10`)
      .then((res) => {
        setData(
          res.data
            .sort((a, b) => a.position - b.position)
            .slice(0, 8)
            .map((e) => ({ name: shortName(e), points: e.totalPoints }))
        )
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [active, rankingMap])

  const { color, label } = categoryConfig[active]
  const chartHeight = Math.max((data.length || 4) * 52, 160)

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Ranking de Pontos</CardTitle>
            <CardDescription>{label} — Temporada 2026</CardDescription>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  active === cat
                    ? 'bg-card text-card-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma entrada no ranking.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={110} className="text-muted-foreground" />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="points" radius={[0, 6, 6, 0]} maxBarSize={32}>
                {data.map((_, index) => (
                  <Cell key={index} fill={color} fillOpacity={1 - index * 0.1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
