import type { Metadata } from 'next'
import { RankingsView } from '@/components/ranking/rankings-view'

export const metadata: Metadata = { title: 'Rankings · Administração · BirdieAtlas' }

export default function RankingsPage() {
  return <RankingsView />
}
