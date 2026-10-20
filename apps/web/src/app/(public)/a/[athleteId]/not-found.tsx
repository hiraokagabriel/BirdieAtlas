import Link from 'next/link'
import { User } from 'lucide-react'

export default function AthleteNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <User className="size-12 text-muted-foreground/40" aria-hidden="true" />
      <h1 className="text-2xl">Atleta não encontrado</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        O link que você acessou não corresponde a nenhum atleta. Verifique se o endereço está correto.
      </p>
      <Link href="/" className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Voltar para o início
      </Link>
    </div>
  )
}
