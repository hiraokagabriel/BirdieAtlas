import { api } from './api.js'
import {
  affiliate,
  createAthlete,
  createAthletes,
  createCategory,
  createClub,
  createRankingWithRules,
  createTournament,
  finalizeTournament,
  playWholeDraw,
  prepareTournament,
  scheduleMatch,
  uniqueTag,
  type Athlete,
  type Club,
  type LiveMatchView,
  type PreparedTournament,
  type Ranking,
  type Registration,
  type Tournament,
} from './factories.js'

// Dados da auditoria WCAG: um de cada estado que muda a interface (torneio encerrado com chave e pódio,
// torneio em andamento com partida ao vivo e agenda, torneio com chave toda jogada pronto para encerrar,
// inscrições pendentes, ranking com pontos, dupla). Tudo usa nomes com acento e sufixo único.

export interface WcagData {
  tag: string
  club: Club
  /** Campeão do torneio encerrado: tem pódio, clube e posição no ranking. */
  champion: Athlete
  ranking: Ranking
  completed: PreparedTournament
  running: PreparedTournament & { liveMatch: LiveMatchView; pendingMatchLabel: string }
  /** Chave toda jogada e ainda não encerrada (abre o diálogo de encerramento). */
  readyToFinalize: PreparedTournament
  /** Inscrições abertas, com atletas pendentes de aprovação. */
  open: { tournament: Tournament; registrations: Registration[] }
  pair: { id: string }
}

export async function prepareWcagData(): Promise<WcagData> {
  const tag = uniqueTag()
  const club = await createClub({ name: `Clube Acessível ${tag}` })

  // Ranking só com regra de nível "local": só os torneios locais deste arquivo pontuam nele, sem alterar
  // as classificações que os outros specs conferem. O ano baixo o deixa depois do ranking do spec público.
  const ranking = await createRankingWithRules({ year: 2050, level: 'local' })

  const athletes = await createAthletes(8, { gender: 'M', prefix: 'Acesso' })
  for (const athlete of athletes) await affiliate(athlete.id, club.id)
  const completedBase = await prepareTournament({
    athletes,
    level: 'local',
    name: `Aberto Acessível ${tag}`,
    startDate: '2097-05-01',
    endDate: '2097-05-03',
  })
  await playWholeDraw(completedBase.draw.id)
  const report = await finalizeTournament(completedBase.tournament.id)
  await api.post(`/tournaments/${completedBase.tournament.id}/award-points`)
  const championId = report.report[0]?.podium.find((p) => p.placement === 1)?.athleteId
  const champion = athletes.find((a) => a.id === championId)
  if (!champion) throw new Error('Campeão do torneio de teste não encontrado.')

  const runningBase = await prepareTournament({ athleteCount: 4, name: `Em Quadra ${tag}` })
  const semis = runningBase.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
  const [semi1, semi2] = semis
  if (!semi1 || !semi2) throw new Error('Semifinais não encontradas.')
  await scheduleMatch(semi1.id, 1, '2098-03-10T12:00:00.000Z')
  await scheduleMatch(semi2.id, 2, '2098-03-10T14:00:00.000Z')
  await api.post(`/draws/matches/${semi1.id}/live/start`, { courtNumber: 1 })
  const live = (await api.get<LiveMatchView[]>(`/tournaments/${runningBase.tournament.id}/live/matches`)).find(
    (m) => m.matchId === semi1.id,
  )
  if (!live) throw new Error('Partida ao vivo não encontrada.')
  await api.post(`/draws/matches/${semi1.id}/live/point`, { side: 1, version: live.version })
  const reg = (id: string | null) => runningBase.registrations.find((r) => r.id === id)?.athleteName ?? ''
  const pendingMatchLabel = `${reg(semi2.registration1Id)} x ${reg(semi2.registration2Id)}`

  const readyToFinalize = await prepareTournament({ athleteCount: 4, name: `Pronto Para Encerrar ${tag}` })
  await playWholeDraw(readyToFinalize.draw.id)

  const openTournament = await createTournament({ name: `Inscrições Abertas ${tag}`, status: 'registration_open' })
  const openCategory = await createCategory(openTournament.id)
  const registrants = await createAthletes(3, { gender: 'M', prefix: 'Inscrito' })
  const registrations: Registration[] = []
  for (const athlete of registrants) {
    registrations.push(
      await api.post<Registration>(`/tournaments/categories/${openCategory.id}/register`, { athleteId: athlete.id }),
    )
  }
  const approved = registrations[0]
  if (approved) await api.post(`/registrations/${approved.id}/approve`, {})

  const [first, second] = athletes
  if (!first || !second) throw new Error('Atletas da dupla não encontrados.')
  const pairMate = await createAthlete({ gender: 'M', name: `Parceiro Acessível ${tag}` })
  const pair = await api.post<{ id: string }>('/pairs', { athlete1Id: first.id, athlete2Id: pairMate.id, discipline: 'MD' })

  return {
    tag,
    club,
    champion,
    ranking,
    completed: completedBase,
    running: { ...runningBase, liveMatch: live, pendingMatchLabel },
    readyToFinalize,
    open: { tournament: openTournament, registrations },
    pair,
  }
}
