import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchX } from 'lucide-react'
import PublicLayout from '@/app/(public)/layout'

export const metadata: Metadata = { title: 'Página não encontrada · BirdieAtlas' }

// Rota que não existe (o Next usa este arquivo no lugar da página 404 padrão, em inglês).
export default function NotFound() {
  return (
    <PublicLayout>
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 py-24 text-center">
        <SearchX className="size-12 text-muted-foreground/60" aria-hidden="true" />
        <h1 className="text-3xl">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          O endereço que você acessou não existe ou foi movido. Confira o link ou volte para o início.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Voltar para o início
        </Link>
      </div>
    </PublicLayout>
  )
}
