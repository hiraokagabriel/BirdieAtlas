'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const data = [
  { name: 'Lucas T.', points: 2400, category: 'MS' },
  { name: 'Rafael S.', points: 1800, category: 'MS' },
  { name: 'Matheus L.', points: 1200, category: 'MS' },
  { name: 'Bruno O.', points: 800, category: 'MS' },
  { name: 'Ana C.', points: 2100, category: 'WS' },
  { name: 'Juliana F.', points: 1600, category: 'WS' },
  { name: 'Camila R.', points: 1100, category: 'WS' },
  { name: 'Fernanda C.', points: 600, category: 'WS' },
]

const colors: Record<string, string> = {
  MS: '#3b82f6',
  WS: '#a855f7',
}

export function RankingChart() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Ranking de Pontos</CardTitle>
        <CardDescription>MS e WS — Temporada 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value, _, props) => [
                `${value} pts`,
                props.payload.category,
              ]}
            />
            <Bar dataKey="points" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={colors[entry.category]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-xs text-muted-foreground">MS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-purple-500" />
            <span className="text-xs text-muted-foreground">WS</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
