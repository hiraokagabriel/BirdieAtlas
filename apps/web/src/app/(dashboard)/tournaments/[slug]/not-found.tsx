import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <p className="text-2xl font-bold">Torneio não encontrado</p>
      <p className="text-muted-foreground">O torneio que você está procurando não existe.</p>
      <Button asChild><Link href="/tournaments">Ver todos os torneios</Link></Button>
    </div>
  )
}
