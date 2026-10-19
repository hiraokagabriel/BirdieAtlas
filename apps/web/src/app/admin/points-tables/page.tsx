import { PointsTableManager } from '@/components/points-table/points-table-manager'

export default function PointsTablesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tabelas de Pontos</h2>
        <p className="text-muted-foreground">
          Defina quantos pontos cada colocação vale por nível de torneio.
        </p>
      </div>
      <PointsTableManager />
    </div>
  )
}
