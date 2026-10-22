import type { Metadata } from 'next'
import { ClubsView } from '@/components/club/clubs-view'

export const metadata: Metadata = { title: 'Clubes · Administração · BirdieAtlas' }

export default function ClubsPage() {
  return <ClubsView />
}
