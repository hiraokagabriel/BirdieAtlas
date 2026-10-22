import type { Metadata } from 'next'
import { AthletesView } from '@/components/athlete/athletes-view'

export const metadata: Metadata = { title: 'Atletas · Administração · BirdieAtlas' }

export default function AthletesPage() {
  return <AthletesView />
}
