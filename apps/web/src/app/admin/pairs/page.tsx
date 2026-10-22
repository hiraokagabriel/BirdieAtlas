import type { Metadata } from 'next'
import { PairsView } from '@/components/pairs/pairs-view'

export const metadata: Metadata = { title: 'Duplas · Administração · BirdieAtlas' }

export default function PairsPage() {
  return <PairsView />
}
