import { CourtConsole } from '@/components/live/court-console'

export default function AdminLivePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Placar ao vivo</h2>
        <p className="text-muted-foreground">Escolha a quadra, inicie a partida e marque os pontos. O público acompanha em tempo real.</p>
      </div>
      <CourtConsole />
    </div>
  )
}
