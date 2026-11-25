import Link from 'next/link'
import type { Metadata } from 'next'
import { BackLink } from '@/components/public/back-link'

export const metadata: Metadata = { title: 'Atleta não encontrado · BirdieAtlas' }

export default function AthleteNotFound() {
  return (
    <div className="space-y-3">
      <BackLink />
      <h1 className="font-heading text-3xl font-bold leading-tight">Atleta não encontrado</h1>
      <p className="max-w-prose text-muted-foreground">
        O link que você acessou não corresponde a nenhum atleta. Confira o endereço ou busque o atleta pelo nome na página inicial.
      </p>
      <Link
        href="/"
        className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground transition-colors hover:bg-primary-strong"
      >
        Voltar para o início
      </Link>
    </div>
  )
}
