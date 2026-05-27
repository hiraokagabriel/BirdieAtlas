'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from 'recharts'

type Category = 'MS' | 'WS' | 'MD' | 'WD' | 'XD'

const allData: Record<Category, { name: string; points: number }[]> = {
  MS: [
    { name: 'Lucas T.', points: 2400 },
    { name: 'Rafael S.', points: 1800 },
    { name: 'Matheus L.', points: 1200 },
    { name: 'Bruno O.', points: 800 },
  ],
  WS: [
    { name: 'Ana C.', points: 2100 },
    { name: 'Juliana F.', points: 1600 },
    { name: 'Camila R.', points: 1100 },
    { name: 'Fernanda C.', points: 600 },
  ],
  MD: [
    { name: 'Lucas / Rafael', points: 1900 },
    { name: 'Matheus / Bruno', points: 1300 },
  ],
  WD: [
    { name: 'Ana / Juliana', points: 1700 },
    { name: 'Camila / Fernanda', points: 900 },
  ],
  XD: [
    { name: 'Lucas / Ana', points: 2000 },
    { name: 'Rafael / Juliana', points: 1400 },
    { name: 'Matheus / Camila', points: 800 },
    { name: 'Bruno / Fernanda', points: 400 },
  ],
}

const categoryConfig: Record<Category, { color: string; label: string }> = {
  MS: { color: '#3b82f6', label: 'Simples Masculino' },
  WS: { color: '#a855f7', label: 'Simples Feminino' },
  MD: { color: '#06b6d4', label: 'Duplas Masculino' },
  WD: { color: '#ec4899', label: 'Duplas Feminino' },
  XD: { color: '#f97316', label: 'Duplas Misto' },
}

const categories: Category[] = ['MS', 'WS', 'MD', 'WD', 'XD']

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.payload.name}</p>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium" style={{ color: entry.fill }}>{entry.value}</span>
        {' pts'}
      </p>
    </div>
  )
}

export function RankingChart() {
  const [active, setActive] = useState<Category>('MS')
  const data = allData[active]
  const { color, label } = categoryConfig[active]

  const chartHeight = Math.max(data.length * 52, 160)

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Ranking de Pontos</CardTitle>
            <CardDescription>{label} — Temporada 2026</CardDescription>
          </div>
          {/* Filter tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  active === cat
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
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
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={100}
              className="text-muted-foreground"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="points" radius={[0, 6, 6, 0]} maxBarSize={32}>
              {data.map((_, index) => (
                <Cell key={index} fill={color} fillOpacity={1 - index * 0.15} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
