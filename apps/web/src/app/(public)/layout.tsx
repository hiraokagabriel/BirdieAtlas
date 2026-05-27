export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header público mínimo */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">🏸 BirdieAtlas</span>
          <span className="text-xs text-muted-foreground">Plataforma de torneios</span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
