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
import { disciplineChartColor } from '@/lib/discipline'
import { ChoiceGroup } from '@/components/ui/choice-group'

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

const categoryLabels: Record<Category, string> = {
  MS: 'Simples Masculino',
  WS: 'Simples Feminino',
  MD: 'Duplas Masculino',
  WD: 'Duplas Feminino',
  XD: 'Duplas Misto',
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
  payload?: { payload: { name: string }; value: number }[]
  color: string
}

function CustomTooltip({ active, payload, color }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-popover-foreground">{entry.payload.name}</p>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium" style={{ color }}>{entry.value}</span>{' pts'}
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

  const label = categoryLabels[active]
  const color = disciplineChartColor(active)
  const chartHeight = Math.max((data.length || 4) * 52, 160)

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Ranking de Pontos</CardTitle>
            <CardDescription>{label} — Temporada 2026</CardDescription>
          </div>
          <ChoiceGroup
            legend="Disciplina do ranking"
            hideLegend
            options={CATEGORIES.map((cat) => ({ value: cat, label: cat, content: cat, labelFromContent: true }))}
            value={active}
            onChange={setActive}
            optionClassName="min-h-8 px-2.5 py-1 text-xs font-semibold"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">Carregando ranking…</span>
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma entrada no ranking.</p>
        ) : (
          <>
          {/* Alternativa em texto do gráfico (WCAG 1.1.1): o desenho fica fora da árvore de acessibilidade. */}
          <table className="sr-only">
            <caption>{label}: pontos dos primeiros colocados</caption>
            <thead>
              <tr>
                <th scope="col">Atleta</th>
                <th scope="col">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={`${row.name}-${index}`}>
                  <th scope="row">{row.name}</th>
                  <td>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart accessibilityLayer={false} data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={110} />
              <Tooltip content={<CustomTooltip color={color} />} cursor={{ fill: 'var(--muted)', fillOpacity: 0.5 }} />
              <Bar dataKey="points" radius={[0, 6, 6, 0]} maxBarSize={32}>
                {data.map((_, index) => (
                  <Cell key={index} fill={color} fillOpacity={1 - index * 0.04} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
