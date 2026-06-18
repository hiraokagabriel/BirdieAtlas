/**
 * seed.ts — BirdieAtlas
 *
 * Popula o banco com dados fictícios relacionais para benchmark e
 * validação da aplicação. Os dados são registros normais, editáveis
 * em tempo real pela UI.
 *
 * USO:
 *   pnpm --filter api db:seed              # perfil medium (padrão)
 *   pnpm --filter api db:seed -- --profile small
 *   pnpm --filter api db:seed -- --profile large
 *   pnpm --filter api db:seed -- --reset   # limpa tudo antes de inserir
 *
 * COMPORTAMENTO SEM --reset:
 *   - Tenants são reaproveitados se já existirem (onConflictDoNothing)
 *   - Clubes, torneios e rankings recebem sufixo único por execução
 *     para evitar colisão de slugs únicos no banco
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import {
  tenants,
  clubs,
  athletes,
  athleteAffiliations,
  tournaments,
  tournamentCategories,
  tournamentRegistrations,
  draws,
  matches,
  matchResults,
  pointsTables,
  rankings,
  pointRules,
  rankingTournaments,
  rankingEntries,
} from '../db/schema.js'

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const PROFILE = (() => {
  const p = args.find((a) => a.startsWith('--profile'))
  if (!p) return 'medium'
  return p.split('=')[1] ?? args[args.indexOf(p) + 1] ?? 'medium'
})() as 'small' | 'medium' | 'large'
const RESET = args.includes('--reset')

// Prefixo único por execução — garante slugs únicos sem precisar de --reset
const RUN_ID = randomUUID().slice(0, 6)

const VOLUMES = {
  small:  { clubs: 4,  athletes: 40,  tournaments: 4,  rankings: 2 },
  medium: { clubs: 12, athletes: 150, tournaments: 12, rankings: 4 },
  large:  { clubs: 30, athletes: 400, tournaments: 30, rankings: 8 },
}

const VOL = VOLUMES[PROFILE] ?? VOLUMES.medium

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = () => randomUUID()

const slugify = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const dateStr = (daysOffset: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString().split('T')[0]
}

const isoTs = (daysOffset = 0): Date => {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d
}

// ---------------------------------------------------------------------------
// Nomes fictícios para atletas brasileiros
// ---------------------------------------------------------------------------

const FIRST_NAMES_M = [
  'Gabriel', 'Lucas', 'Mateus', 'Rafael', 'Felipe', 'Bruno', 'Pedro',
  'João', 'Thiago', 'Gustavo', 'Diego', 'Rodrigo', 'Vinicius', 'Henrique',
  'Eduardo', 'Carlos', 'André', 'Fernando', 'Marcelo', 'Paulo',
  'Leonardo', 'Alexandre', 'Daniel', 'Ricardo', 'Leandro', 'Igor',
]

const FIRST_NAMES_F = [
  'Ana', 'Julia', 'Mariana', 'Beatriz', 'Carolina', 'Camila', 'Larissa',
  'Amanda', 'Isabela', 'Fernanda', 'Gabriela', 'Natalia', 'Patricia',
  'Renata', 'Vanessa', 'Leticia', 'Bruna', 'Aline', 'Juliana', 'Tatiana',
  'Priscila', 'Debora', 'Luana', 'Claudia', 'Alessandra',
]

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira',
  'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins',
  'Carvalho', 'Almeida', 'Lopes', 'Sousa', 'Fernandes', 'Vieira',
  'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moraes',
  'Nunes', 'Cardoso', 'Teixeira', 'Araujo', 'Mendes',
]

const CITIES = [
  'São Paulo', 'Rio de Janeiro', 'Curitiba', 'Belo Horizonte', 'Porto Alegre',
  'Florianópolis', 'Campinas', 'Manaus', 'Salvador', 'Recife',
  'Fortaleza', 'Brasília', 'Goiânia', 'Belém', 'Maceió',
]

const STATES = ['SP', 'RJ', 'PR', 'MG', 'RS', 'SC', 'AM', 'BA', 'PE', 'CE', 'DF', 'GO', 'PA', 'AL']

const CLUB_PREFIXES = ['Associação', 'Clube', 'Equipe', 'Instituto', 'Centro Esportivo', 'Academia']
const CLUB_NAMES = [
  'Badminton SP', 'Raquetes do Sul', 'Vôo Livre', 'Penas e Redes', 'Smash FC',
  'Net Attack', 'Rally Point', 'Quadra Aberta', 'Alta Performance', 'Top Spin',
  'Birdie Masters', 'Shuttle Team', 'Drop Shot', 'Clear Point', 'Drive Club',
  'Flick Team', 'Lift Esportes', 'Push FC', 'Cross Court', 'Base Line',
  'Jump Smash', 'Net Rush', 'Back Court', 'Power Play', 'Speed Court',
  'Golden Birdie', 'Silver Racket', 'Elite Shuttle', 'Pro Net', 'Champion Court',
]

const TOURNAMENT_PREFIXES = [
  'Campeonato', 'Torneio', 'Open', 'Copa', 'Grand Prix', 'Circuito', 'Masters',
]
const TOURNAMENT_THEMES = [
  'Estadual', 'Regional', 'Municipal', 'Nacional', 'Paulista', 'Carioca',
  'Paranaense', 'Gaúcho', 'Mineiro', 'Nordestino', 'Sul-Americano',
  'Verão', 'Inverno', 'Primavera', 'Outono', 'Aniversário', 'Challenge',
]

const LEVELS: Array<'local' | 'regional' | 'state' | 'national' | 'international'> = [
  'local', 'regional', 'state', 'national', 'international',
]

const DISCIPLINES: Array<'MS' | 'WS' | 'MD' | 'WD' | 'XD'> = ['MS', 'WS', 'MD', 'WD', 'XD']

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool)

  console.log(`\n🌱 BirdieAtlas Seed — perfil: ${PROFILE.toUpperCase()} | run: ${RUN_ID}\n`)

  // -------------------------------------------------------------------------
  // 1. RESET (opcional)
  // -------------------------------------------------------------------------
  if (RESET) {
    console.log('🗑  Limpando banco (--reset)...')
    await db.delete(rankingEntries)
    await db.delete(rankingTournaments)
    await db.delete(pointRules)
    await db.delete(rankings)
    await db.delete(matchResults)
    await db.delete(matches)
    await db.delete(draws)
    await db.delete(tournamentRegistrations)
    await db.delete(tournamentCategories)
    await db.delete(pointsTables)
    await db.delete(tournaments)
    await db.delete(athleteAffiliations)
    await db.delete(athletes)
    await db.delete(clubs)
    await db.delete(tenants)
    console.log('✅ Banco limpo.\n')
  }

  // -------------------------------------------------------------------------
  // 2. TENANTS
  // Tenants têm slugs fixos e representam entidades reais de infra.
  // Usamos onConflictDoNothing para reaproveitar os existentes entre execuções.
  // -------------------------------------------------------------------------
  console.log('👥 Criando tenants...')
  const tenantDefs = [
    { id: uid(), name: 'Confederação Brasileira de Badminton', slug: 'cbb-br', country: 'BR' },
    { id: uid(), name: 'Federação Paulista de Badminton', slug: 'fpb-sp', country: 'BR' },
  ]
  await db.insert(tenants).values(tenantDefs).onConflictDoNothing()

  // Busca os IDs reais (podem ser de uma inserção anterior)
  const [tenant, tenant2] = await Promise.all([
    db.select().from(tenants).where(eq(tenants.slug, 'cbb-br')).then((r) => r[0]),
    db.select().from(tenants).where(eq(tenants.slug, 'fpb-sp')).then((r) => r[0]),
  ])

  if (!tenant || !tenant2) throw new Error('Tenants não encontrados após upsert.')
  console.log(`   ✓ tenants (reutilizados ou criados)`)

  // -------------------------------------------------------------------------
  // 3. TABELAS DE PONTOS
  // -------------------------------------------------------------------------
  console.log('📊 Criando tabelas de pontos...')
  const placements = [1, 2, 3, 5, 9, 17, 25, 33]
  const levelPointsMap: Record<string, number[]> = {
    international: [4000, 3200, 2400, 1600, 800, 400, 200, 100],
    national:      [2000, 1600, 1200,  800, 400, 200, 100,  50],
    state:         [1000,  800,  600,  400, 200, 100,  50,  25],
    regional:      [ 500,  400,  300,  200, 100,  50,  25,  10],
    local:         [ 250,  200,  150,  100,  50,  25,  10,   5],
  }

  const pointsTableData: typeof pointsTables.$inferInsert[] = []

  for (const [level, pointsArr] of Object.entries(levelPointsMap)) {
    for (let i = 0; i < placements.length; i++) {
      pointsTableData.push({
        id: uid(),
        tenantId: tenant.id,
        name: `Tabela ${level.charAt(0).toUpperCase() + level.slice(1)} [${RUN_ID}]`,
        tournamentLevel: level,
        placement: placements[i],
        points: pointsArr[i],
      })
    }
  }
  await db.insert(pointsTables).values(pointsTableData)
  console.log(`   ✓ ${pointsTableData.length} entradas de pontos (5 níveis × 8 colocações)`)

  // -------------------------------------------------------------------------
  // 4. CLUBS
  // Slug inclui RUN_ID para ser único entre execuções.
  // -------------------------------------------------------------------------
  console.log('🏢 Criando clubes...')
  const clubData: typeof clubs.$inferInsert[] = []
  for (let i = 0; i < VOL.clubs; i++) {
    const tenantRef = i % 3 === 0 ? tenant2.id : tenant.id
    const baseName = `${CLUB_PREFIXES[i % CLUB_PREFIXES.length]} ${CLUB_NAMES[i % CLUB_NAMES.length]}`
    const city = CITIES[i % CITIES.length]
    const state = STATES[i % STATES.length]
    clubData.push({
      id: uid(),
      name: `${baseName} [${RUN_ID}]`,
      slug: `${slugify(baseName)}-${RUN_ID}-${i}`,
      tenantId: tenantRef,
      city,
      state,
      active: true,
    })
  }
  await db.insert(clubs).values(clubData)
  console.log(`   ✓ ${clubData.length} clubes`)

  // -------------------------------------------------------------------------
  // 5. ATHLETES
  // Email inclui RUN_ID para ser único entre execuções.
  // -------------------------------------------------------------------------
  console.log('🏃 Criando atletas...')
  const athleteData: typeof athletes.$inferInsert[] = []
  for (let i = 0; i < VOL.athletes; i++) {
    const gender = i % 2 === 0 ? 'M' : 'F'
    const firstName = gender === 'M'
      ? FIRST_NAMES_M[i % FIRST_NAMES_M.length]
      : FIRST_NAMES_F[i % FIRST_NAMES_F.length]
    const lastName = LAST_NAMES[i % LAST_NAMES.length]
    const name = `${firstName} ${lastName}`
    const birthYear = 1980 + (i % 25)
    athleteData.push({
      id: uid(),
      name,
      email: `atleta${i + 1}-${RUN_ID}@birdieatlas.dev`,
      gender: gender as 'M' | 'F',
      birthDate: `${birthYear}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      nationality: 'BR',
      active: true,
    })
  }
  await db.insert(athletes).values(athleteData)
  console.log(`   ✓ ${athleteData.length} atletas`)

  // -------------------------------------------------------------------------
  // 6. AFFILIATIONS
  // -------------------------------------------------------------------------
  console.log('🔗 Criando afiliações atleta→clube...')
  const affiliationData: typeof athleteAffiliations.$inferInsert[] = []
  for (let i = 0; i < athleteData.length; i++) {
    const club = clubData[i % clubData.length]
    affiliationData.push({
      id: uid(),
      athleteId: athleteData[i].id!,
      clubId: club.id!,
      tenantId: club.tenantId,
      startedAt: dateStr(-365 - (i % 365)),
    })
  }
  await db.insert(athleteAffiliations).values(affiliationData)
  console.log(`   ✓ ${affiliationData.length} afiliações`)

  // -------------------------------------------------------------------------
  // 7. TOURNAMENTS
  // Slug inclui RUN_ID para ser único entre execuções.
  // -------------------------------------------------------------------------
  console.log('🏆 Criando torneios...')
  const tournamentData: typeof tournaments.$inferInsert[] = []
  for (let i = 0; i < VOL.tournaments; i++) {
    const level = LEVELS[i % LEVELS.length]
    const prefix = TOURNAMENT_PREFIXES[i % TOURNAMENT_PREFIXES.length]
    const theme = TOURNAMENT_THEMES[i % TOURNAMENT_THEMES.length]
    const year = 2025 + Math.floor(i / 12)
    const name = `${prefix} ${theme} ${year} - Etapa ${(i % 4) + 1}`
    const startOffset = -180 + i * 15
    const statuses: Array<typeof tournaments.$inferInsert['status']> = [
      'completed', 'completed', 'completed',
      'in_progress', 'registration_open', 'draft',
    ]
    tournamentData.push({
      id: uid(),
      tenantId: i % 3 === 0 ? tenant2.id : tenant.id,
      name: `${name} [${RUN_ID}]`,
      slug: `${slugify(name)}-${RUN_ID}-${i}`,
      status: statuses[i % statuses.length],
      level,
      startDate: dateStr(startOffset),
      endDate: dateStr(startOffset + 2),
      location: `Arena ${CITIES[i % CITIES.length]}`,
      city: CITIES[i % CITIES.length],
      state: STATES[i % STATES.length],
      pointsAwarded: i % statuses.length < 3,
    })
  }
  await db.insert(tournaments).values(tournamentData)
  console.log(`   ✓ ${tournamentData.length} torneios`)

  // -------------------------------------------------------------------------
  // 8. TOURNAMENT CATEGORIES
  // -------------------------------------------------------------------------
  console.log('📋 Criando categorias de torneio...')
  const categoryData: typeof tournamentCategories.$inferInsert[] = []
  for (const tourn of tournamentData) {
    const numCategories = 3 + Math.floor(Math.random() * 3)
    const shuffled = [...DISCIPLINES].sort(() => Math.random() - 0.5)
    for (let i = 0; i < numCategories; i++) {
      const disc = shuffled[i % shuffled.length]
      categoryData.push({
        id: uid(),
        tournamentId: tourn.id!,
        discipline: disc,
        name: `${disc} - ${tourn.name}`,
        drawType: 'single_elimination',
        maxEntries: 32,
        seedCount: 4,
      })
    }
  }
  await db.insert(tournamentCategories).values(categoryData)
  console.log(`   ✓ ${categoryData.length} categorias`)

  // -------------------------------------------------------------------------
  // 9. REGISTRATIONS
  // -------------------------------------------------------------------------
  console.log('📝 Criando inscrições...')
  const registrationData: typeof tournamentRegistrations.$inferInsert[] = []
  const maleAthletes = athleteData.filter((a) => a.gender === 'M')
  const femaleAthletes = athleteData.filter((a) => a.gender === 'F')

  for (const cat of categoryData) {
    const isDouble = ['MD', 'WD', 'XD'].includes(cat.discipline)
    let pool: typeof athleteData = []
    if (cat.discipline === 'MS') pool = maleAthletes
    else if (cat.discipline === 'WS') pool = femaleAthletes
    else if (cat.discipline === 'MD') pool = maleAthletes
    else if (cat.discipline === 'WD') pool = femaleAthletes
    else pool = athleteData

    if (pool.length < 2) continue

    const numEntries = 8 + Math.floor(Math.random() * 9)
    const usedAthletes = new Set<string>()
    for (let i = 0; i < numEntries; i++) {
      const available = pool.filter((a) => !usedAthletes.has(a.id!))
      if (available.length < 1) break
      const athlete = available[Math.floor(Math.random() * available.length)]
      usedAthletes.add(athlete.id!)

      let athlete2Id: string | undefined = undefined
      if (isDouble) {
        let partner2Pool = pool
        if (cat.discipline === 'XD') {
          partner2Pool = athlete.gender === 'M' ? femaleAthletes : maleAthletes
        }
        const available2 = partner2Pool.filter((a) => !usedAthletes.has(a.id!))
        if (available2.length === 0) break
        const a2 = available2[Math.floor(Math.random() * available2.length)]
        usedAthletes.add(a2.id!)
        athlete2Id = a2.id
      }

      registrationData.push({
        id: uid(),
        categoryId: cat.id!,
        athleteId: athlete.id!,
        athlete2Id,
        confirmed: Math.random() > 0.1,
        withdrew: false,
        seed: i < 4 ? i + 1 : undefined,
        finalPlacement: undefined,
      })
    }
  }
  await db.insert(tournamentRegistrations).values(registrationData)
  console.log(`   ✓ ${registrationData.length} inscrições`)

  // -------------------------------------------------------------------------
  // 10. DRAWS + MATCHES
  // -------------------------------------------------------------------------
  console.log('🎯 Criando chaves e partidas...')
  const completedTournIds = new Set(
    tournamentData.filter((t) => t.status === 'completed').map((t) => t.id),
  )
  const completedCategories = categoryData.filter((c) =>
    completedTournIds.has(c.tournamentId),
  )

  const drawData: typeof draws.$inferInsert[] = []
  const matchData: typeof matches.$inferInsert[] = []
  const matchResultData: typeof matchResults.$inferInsert[] = []
  const updatedRegistrations = [...registrationData]

  for (const cat of completedCategories) {
    const catRegs = registrationData.filter((r) => r.categoryId === cat.id && r.confirmed)
    if (catRegs.length < 2) continue

    const drawId = uid()
    drawData.push({
      id: drawId,
      categoryId: cat.id!,
      published: true,
      drawMode: 'random',
    })

    const slots = 8
    const rounds = Math.log2(slots)

    for (let round = 1; round <= rounds; round++) {
      const matchesInRound = slots / Math.pow(2, round)
      for (let pos = 1; pos <= matchesInRound; pos++) {
        const matchId = uid()
        const reg1 = round === 1 ? catRegs[(pos - 1) * 2] : undefined
        const reg2 = round === 1 ? catRegs[(pos - 1) * 2 + 1] : undefined
        const hasResult = round <= 2
        const score1win = [21, 21]
        const score2win = [15, 15]

        matchData.push({
          id: matchId,
          drawId,
          round,
          position: pos,
          registration1Id: reg1?.id ?? null,
          registration2Id: reg2?.id ?? null,
          status: hasResult ? 'completed' : 'pending',
          scheduledAt: isoTs(-180 + completedCategories.indexOf(cat) * 2),
        })

        if (hasResult && reg1 && reg2) {
          const reg1Wins = Math.random() > 0.5
          for (let set = 1; set <= 2; set++) {
            matchResultData.push({
              id: uid(),
              matchId,
              setNumber: set,
              score1: reg1Wins ? score1win[set - 1] : score2win[set - 1],
              score2: reg1Wins ? score2win[set - 1] : score1win[set - 1],
            })
          }
        }
      }
    }

    const finalRegs = catRegs.slice(0, Math.min(catRegs.length, 4))
    finalRegs.forEach((reg, i) => {
      const found = updatedRegistrations.find((r) => r.id === reg.id)
      if (found) found.finalPlacement = i + 1
    })
  }

  if (drawData.length > 0) await db.insert(draws).values(drawData)
  if (matchData.length > 0) await db.insert(matches).values(matchData)
  if (matchResultData.length > 0) await db.insert(matchResults).values(matchResultData)
  console.log(`   ✓ ${drawData.length} chaves | ${matchData.length} partidas | ${matchResultData.length} sets`)

  // -------------------------------------------------------------------------
  // 11. RANKINGS
  // -------------------------------------------------------------------------
  console.log('📈 Criando rankings...')
  const rankingData: typeof rankings.$inferInsert[] = []
  const rankingDiscs: Array<'MS' | 'WS' | 'MD' | 'WD' | 'XD'> = ['MS', 'WS', 'MD', 'WD', 'XD']

  for (let i = 0; i < VOL.rankings; i++) {
    const disc = rankingDiscs[i % rankingDiscs.length]
    const year = 2025 + Math.floor(i / 5)
    const name = `Ranking ${disc} ${year} [${RUN_ID}]`
    rankingData.push({
      id: uid(),
      tenantId: i % 2 === 0 ? tenant.id : tenant2.id,
      name,
      slug: `ranking-${disc.toLowerCase()}-${year}-${RUN_ID}-${i}`,
      description: `Ranking oficial da modalidade ${disc} para o ano ${year}`,
      discipline: disc,
      year,
      status: 'active',
      countBestResults: 6,
      minTournamentsRequired: 1,
      isPublic: true,
      autoInclude: false,
      lastCalculatedAt: isoTs(-1),
    })
  }
  await db.insert(rankings).values(rankingData)
  console.log(`   ✓ ${rankingData.length} rankings`)

  // -------------------------------------------------------------------------
  // 12. POINT RULES
  // -------------------------------------------------------------------------
  console.log('📐 Criando regras de pontos...')
  const pointRuleData: typeof pointRules.$inferInsert[] = []
  const entryStructure = [
    { placement: 1, basePoints: 1000 },
    { placement: 2, basePoints: 800 },
    { placement: 3, basePoints: 600 },
    { placement: 5, basePoints: 400 },
    { placement: 9, basePoints: 200 },
    { placement: 17, basePoints: 100 },
  ]

  for (const ranking of rankingData) {
    for (const level of (['state', 'national', 'international'] as const)) {
      const multiplierMap = { state: 1.0, national: 1.5, international: 2.0 }
      pointRuleData.push({
        id: uid(),
        rankingId: ranking.id!,
        tournamentLevel: level,
        discipline: ranking.discipline,
        multiplier: multiplierMap[level],
        participationBonus: 10,
        entries: entryStructure,
      })
    }
  }
  await db.insert(pointRules).values(pointRuleData)
  console.log(`   ✓ ${pointRuleData.length} regras de pontos`)

  // -------------------------------------------------------------------------
  // 13. RANKING TOURNAMENTS
  // -------------------------------------------------------------------------
  console.log('🔗 Vinculando torneios aos rankings...')
  const rankingTournamentData: typeof rankingTournaments.$inferInsert[] = []
  const completedTournList = tournamentData.filter((t) => t.status === 'completed')

  for (const ranking of rankingData) {
    const relevantTourns = completedTournList.filter(
      (t) => t.tenantId === ranking.tenantId,
    )
    const toLink = relevantTourns.slice(0, Math.min(relevantTourns.length, 5))
    for (const tourn of toLink) {
      rankingTournamentData.push({
        id: uid(),
        rankingId: ranking.id!,
        tournamentId: tourn.id!,
        tournamentMultiplier: 1.0,
        isScoring: true,
      })
    }
  }
  if (rankingTournamentData.length > 0) {
    await db.insert(rankingTournaments).values(rankingTournamentData)
  }
  console.log(`   ✓ ${rankingTournamentData.length} vínculos ranking↔torneio`)

  // -------------------------------------------------------------------------
  // 14. RANKING ENTRIES
  // -------------------------------------------------------------------------
  console.log('🥇 Criando entradas de ranking...')
  const rankingEntryData: typeof rankingEntries.$inferInsert[] = []

  for (const ranking of rankingData) {
    const isDouble = ['MD', 'WD', 'XD'].includes(ranking.discipline)
    const relevantAthletes =
      ranking.discipline === 'WS' || ranking.discipline === 'WD'
        ? femaleAthletes
        : ranking.discipline === 'MS' || ranking.discipline === 'MD'
          ? maleAthletes
          : athleteData

    const topN = Math.min(relevantAthletes.length, 30)
    const sorted = [...relevantAthletes].sort(() => Math.random() - 0.5).slice(0, topN)

    let position = 1
    for (let i = 0; i < sorted.length; i += isDouble ? 2 : 1) {
      const athlete = sorted[i]
      const athlete2 = isDouble ? sorted[i + 1] : undefined
      if (!athlete) break

      const totalPoints = Math.round(1000 - (position - 1) * 30 + Math.random() * 20)

      rankingEntryData.push({
        id: uid(),
        rankingId: ranking.id!,
        athleteId: athlete.id!,
        athlete2Id: athlete2?.id,
        position,
        previousPosition: position + Math.floor(Math.random() * 5) - 2,
        totalPoints,
        tournamentsCount: Math.max(1, Math.floor(Math.random() * 8)),
        resultsDetail: [],
        manualAdjustment: 0,
        calculatedAt: isoTs(-1),
      })

      position++
    }
  }
  if (rankingEntryData.length > 0) {
    await db.insert(rankingEntries).values(rankingEntryData)
  }
  console.log(`   ✓ ${rankingEntryData.length} entradas de ranking`)

  // -------------------------------------------------------------------------
  // SUMÁRIO
  // -------------------------------------------------------------------------
  console.log(`
✅ Seed concluído! [run: ${RUN_ID}]\n
   Tenants:               2 (reutilizados ou criados)
   Clubes:                ${clubData.length}
   Atletas:               ${athleteData.length}
   Afiliações:            ${affiliationData.length}
   Torneios:              ${tournamentData.length}
   Categorias:            ${categoryData.length}
   Inscrições:            ${registrationData.length}
   Chaves:                ${drawData.length}
   Partidas:              ${matchData.length}
   Sets:                  ${matchResultData.length}
   Tabelas de pontos:     ${pointsTableData.length}
   Rankings:              ${rankingData.length}
   Regras de pontos:      ${pointRuleData.length}
   Vínculos rank↔tourn:   ${rankingTournamentData.length}
   Entradas de ranking:   ${rankingEntryData.length}
`)

  await pool.end()
}

seed().catch((err) => {
  console.error('\n❌ Erro no seed:', err)
  process.exit(1)
})
