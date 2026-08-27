'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Athlete {
  id: string
  name: string
  gender: 'M' | 'F'
  club?: { id: string; name: string }
  createdAt: string
}

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/athletes')
      .then((res) => res.json())
      .then((data) => {
        setAthletes(data.data || data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Atletas</h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Atletas</h1>
        <Link href="/dashboard/athletes/new" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          Novo Atleta
        </Link>
      </div>

      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left font-medium">Nome</th>
              <th className="p-3 text-left font-medium">Genero</th>
              <th className="p-3 text-left font-medium">Clube</th>
              <th className="p-3 text-left font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {athletes.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum atleta cadastrado</td></tr>
            ) : (
              athletes.map((athlete) => (
                <tr key={athlete.id} className="border-t hover:bg-muted/50">
                  <td className="p-3"><Link href={`/dashboard/athletes/${athlete.id}`} className="text-primary hover:underline">{athlete.name}</Link></td>
                  <td className="p-3">{athlete.gender === 'M' ? 'Masculino' : 'Feminino'}</td>
                  <td className="p-3">{athlete.club?.name || '—'}</td>
                  <td className="p-3">
                    <Link href={`/dashboard/athletes/${athlete.id}`} className="text-primary hover:underline mr-3">Ver</Link>
                    <Link href={`/dashboard/athletes/edit?id=${athlete.id}`} className="text-primary hover:underline">Editar</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
