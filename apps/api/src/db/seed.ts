import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { randomUUID } from 'crypto'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/birdie_atlas',
})
const db = drizzle(pool, { schema })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const maleFirstNames = [
  'Lucas','Rafael','Matheus','Bruno','Pedro','Gabriel','Thiago','Diego','Felipe','André',
  'Rodrigo','Gustavo','Henrique','Eduardo','Vinicius','Leonardo','Carlos','Paulo','Marcelo','Renato',
  'Fábio','Caio','Danilo','Igor','Leandro','Maurício','Natan','Otávio','Patrick','Quirino',
  'Sérgio','Tiago','Ulisses','Valério','Wagner','Xavier','Yuri','Zé','Alessandro','Bernardo',
  'Cícero','Davi','Ezequiel','Frederico','Guilherme','Hélio','Ivan','João','Kléber','Lorenzo',
]
const femaleFirstNames = [
  'Ana','Juliana','Camila','Fernanda','Beatriz','Larissa','Isabela','Vanessa','Mariana','Gabriela',
  'Letícia','Natália','Rafaela','Simone','Tatiane','Úrsula','Viviane','Wanessa','Yasmin','Zélia',
  'Amanda','Bruna','Caroline','Débora','Elaine','Flávia','Giovana','Helena','Ingrid','Joana',
  'Késia','Lívia','Mônica','Naiara','Olivia','Patrícia','Roberta','Sandra','Talita','Ursula',
  'Vitória','Walkiria','Xênia','Yara','Zelma','Alice','Bárbara','Cláudia','Denise','Érica',
]
const lastNames = [
  'Silva','Santos','Oliveira','Souza','Lima','Ferreira','Costa','Pereira','Carvalho','Martins',
  'Rocha','Alves','Nascimento','Araújo','Ribeiro','Mendes','Gomes','Barbosa','Cardoso','Moreira',
  'Nunes','Campos','Cavalcanti','Dias','Freitas','Gonçalves','Henrique','Ito','Jardim','Kawaguchi',
  'Luz','Monteiro','Nogueira','Ortiz','Pinto','Queiroz','Ramos','Teixeira','Vargas','Yamamoto',
  'Tanaka','Nakamura','Suzuki','Watanabe','Kobayashi','Ishida','Fujita','Miyamoto','Sato','Endo',
]

function makeName(first: string, last: string) { return `${first} ${last}` }
function makeEmail(first: string, last: string, i: number) {
  return `${first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')}.${last.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')}${i}@birdieseed.com`
}
function rndDate(from: number, to: number) {
  const y = from + Math.floor(Math.random() * (to - from))
  const m = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const d = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function seed() {
  console.log('🌱 Seeding database...')

  // ---------------------------------------------------------------------------
  // Tenants
  // ---------------------------------------------------------------------------
  const [tenantSP, tenantRJ] = await db
    .insert(schema.tenants)
    .values([
      { id: randomUUID(), name: 'Federação Paulista de Badminton', slug: 'fpb-sp', country: 'BR' },
      { id: randomUUID(), name: 'Federação Carioca de Badminton', slug: 'fcb-rj', country: 'BR' },
    ])
    .returning()

  // ---------------------------------------------------------------------------
  // Clubs — SP (5) + RJ (3)
  // ---------------------------------------------------------------------------
  const [clubSP1, clubSP2, clubSP3, clubSP4, clubSP5, clubRJ1, clubRJ2, clubRJ3] = await db
    .insert(schema.clubs)
    .values([
      { id: randomUUID(), name: 'Clube Atlético Paulistano',        slug: 'cap-sp',      tenantId: tenantSP.id, city: 'São Paulo',       state: 'SP' },
      { id: randomUUID(), name: 'Esporte Clube Pinheiros',          slug: 'ecp-sp',      tenantId: tenantSP.id, city: 'São Paulo',       state: 'SP' },
      { id: randomUUID(), name: 'Associação Campineira de Badminton',slug: 'acb-campinas',tenantId: tenantSP.id, city: 'Campinas',       state: 'SP' },
      { id: randomUUID(), name: 'Badminton Clube de Santos',        slug: 'bcs-santos',  tenantId: tenantSP.id, city: 'Santos',         state: 'SP' },
      { id: randomUUID(), name: 'São Bernardo Badminton',           slug: 'sbb-sp',      tenantId: tenantSP.id, city: 'São Bernardo',   state: 'SP' },
      { id: randomUUID(), name: 'Clube de Regatas do Flamengo',     slug: 'crf-rj',      tenantId: tenantRJ.id, city: 'Rio de Janeiro', state: 'RJ' },
      { id: randomUUID(), name: 'Botafogo de Futebol e Regatas',    slug: 'bfr-rj',      tenantId: tenantRJ.id, city: 'Rio de Janeiro', state: 'RJ' },
      { id: randomUUID(), name: 'Niterói Badminton Clube',          slug: 'nbc-rj',      tenantId: tenantRJ.id, city: 'Niterói',       state: 'RJ' },
    ])
    .returning()

  const spClubs = [clubSP1, clubSP2, clubSP3, clubSP4, clubSP5]
  const rjClubs = [clubRJ1, clubRJ2, clubRJ3]

  // ---------------------------------------------------------------------------
  // 100 Athletes — 60 M (SP) + 40 F (SP), depois afiliações em RJ também
  // Split: 70 SP, 30 RJ
  // ---------------------------------------------------------------------------
  const athleteValues: Parameters<typeof db.insert>[0] extends never ? never :
    { id: string; name: string; email: string; gender: 'M' | 'F'; birthDate: string; nationality: string }[] = []

  // 50 homens
  for (let i = 0; i < 50; i++) {
    const first = maleFirstNames[i % maleFirstNames.length]
    const last  = lastNames[i % lastNames.length]
    athleteValues.push({ id: randomUUID(), name: makeName(first, last), email: makeEmail(first, last, i), gender: 'M', birthDate: rndDate(1990, 2005), nationality: 'BR' })
  }
  // 50 mulheres
  for (let i = 0; i < 50; i++) {
    const first = femaleFirstNames[i % femaleFirstNames.length]
    const last  = lastNames[(i + 7) % lastNames.length]
    athleteValues.push({ id: randomUUID(), name: makeName(first, last), email: makeEmail(first, last, i + 100), gender: 'F', birthDate: rndDate(1990, 2005), nationality: 'BR' })
  }

  const allAthletes = await db.insert(schema.athletes).values(athleteValues).returning()
  const males   = allAthletes.filter((a) => a.gender === 'M')
  const females = allAthletes.filter((a) => a.gender === 'F')

  // Afiliações — primeiros 70 em SP, últimos 30 em RJ
  const affiliationValues = allAthletes.map((a, i) => {
    if (i < 70) {
      return { id: randomUUID(), athleteId: a.id, clubId: spClubs[i % spClubs.length].id, tenantId: tenantSP.id, startedAt: '2022-01-01', endedAt: null as string | null }
    } else {
      return { id: randomUUID(), athleteId: a.id, clubId: rjClubs[i % rjClubs.length].id, tenantId: tenantRJ.id, startedAt: '2022-01-01', endedAt: null as string | null }
    }
  })
  await db.insert(schema.athleteAffiliations).values(affiliationValues)

  // ---------------------------------------------------------------------------
  // Points Tables — Tabela Estadual SP 2026
  // ---------------------------------------------------------------------------
  const ptRows = [
    { placement: 1, points: 1000 },
    { placement: 2, points: 700 },
    { placement: 3, points: 500 },
    { placement: 4, points: 500 },
    { placement: 5, points: 300 },
    { placement: 6, points: 300 },
    { placement: 7, points: 300 },
    { placement: 8, points: 300 },
    { placement: 9, points: 150 },
    { placement: 16, points: 100 },
    { placement: 17, points: 50 },
    { placement: 32, points: 25 },
  ]
  const [ptSP] = await db
    .insert(schema.pointsTables)
    .values({ id: randomUUID(), tenantId: tenantSP.id, name: 'Tabela Estadual SP 2026', tournamentLevel: 'estadual', placement: ptRows[0].placement, points: ptRows[0].points })
    .returning()
  if (ptRows.length > 1) {
    await db.insert(schema.pointsTables).values(
      ptRows.slice(1).map((r) => ({ id: randomUUID(), tenantId: tenantSP.id, name: 'Tabela Estadual SP 2026', tournamentLevel: 'estadual', placement: r.placement, points: r.points }))
    )
  }

  // ---------------------------------------------------------------------------
  // Rankings — MS, WS, MD, WD, XD para SP 2026
  // ---------------------------------------------------------------------------
  const [rankMS, rankWS, rankMD, rankWD, rankXD] = await db
    .insert(schema.rankings)
    .values([
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Ranking Simples Masculino A — 2026', discipline: 'MS', year: 2026 },
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Ranking Simples Feminino A — 2026',  discipline: 'WS', year: 2026 },
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Ranking Duplas Masculino A — 2026',  discipline: 'MD', year: 2026 },
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Ranking Duplas Feminino A — 2026',   discipline: 'WD', year: 2026 },
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Ranking Duplas Misto A — 2026',      discipline: 'XD', year: 2026 },
    ])
    .returning()

  // MS — 50 homens com pontos decrescentes realistas
  const msPoints = [3200,2900,2600,2400,2200,2100,1950,1800,1700,1600,1500,1450,1400,1350,1300,1250,1200,1150,1100,1050,1000,980,960,940,920,900,880,860,840,820,800,780,760,740,720,700,680,660,640,620,600,580,560,540,520,500,480,460,440,420]
  await db.insert(schema.rankingEntries).values(
    males.map((a, i) => ({ id: randomUUID(), rankingId: rankMS.id, athleteId: a.id, points: msPoints[i] ?? 100, position: i + 1 }))
  )

  // WS — 50 mulheres
  const wsPoints = [2800,2500,2300,2100,1950,1800,1700,1600,1500,1400,1350,1300,1250,1200,1150,1100,1050,1000,980,960,940,920,900,880,860,840,820,800,780,760,740,720,700,680,660,640,620,600,580,560,540,520,500,480,460,440,420,400,380,360]
  await db.insert(schema.rankingEntries).values(
    females.map((a, i) => ({ id: randomUUID(), rankingId: rankWS.id, athleteId: a.id, points: wsPoints[i] ?? 100, position: i + 1 }))
  )

  // MD — 25 duplas masculinas
  const mdDuos = Array.from({ length: 25 }, (_, i) => ({ a1: males[i * 2], a2: males[i * 2 + 1] }))
  await db.insert(schema.rankingEntries).values(
    mdDuos.map(({ a1, a2 }, i) => ({ id: randomUUID(), rankingId: rankMD.id, athleteId: a1.id, athlete2Id: a2.id, points: 2600 - i * 100, position: i + 1 }))
  )

  // WD — 25 duplas femininas
  const wdDuos = Array.from({ length: 25 }, (_, i) => ({ a1: females[i * 2], a2: females[i * 2 + 1] }))
  await db.insert(schema.rankingEntries).values(
    wdDuos.map(({ a1, a2 }, i) => ({ id: randomUUID(), rankingId: rankWD.id, athleteId: a1.id, athlete2Id: a2.id, points: 2400 - i * 90, position: i + 1 }))
  )

  // XD — 25 duplas mistas
  const xdDuos = Array.from({ length: 25 }, (_, i) => ({ a1: males[i], a2: females[i] }))
  await db.insert(schema.rankingEntries).values(
    xdDuos.map(({ a1, a2 }, i) => ({ id: randomUUID(), rankingId: rankXD.id, athleteId: a1.id, athlete2Id: a2.id, points: 2700 - i * 95, position: i + 1 }))
  )

  // ---------------------------------------------------------------------------
  // Tournament — Campeonato Paulista 2026
  // ---------------------------------------------------------------------------
  const [tournSP] = await db
    .insert(schema.tournaments)
    .values([{
      id: randomUUID(), tenantId: tenantSP.id,
      name: 'Campeonato Paulista de Badminton 2026', slug: 'cpb-2026',
      status: 'in_progress', level: 'estadual',
      startDate: '2026-05-20', endDate: '2026-05-25',
      location: 'Ginásio do Ibirapuera', city: 'São Paulo', state: 'SP',
      pointsTableId: ptSP.id, rankingId: rankMS.id,
    }])
    .returning()

  await db.insert(schema.tournaments).values([{
    id: randomUUID(), tenantId: tenantRJ.id,
    name: 'Campeonato Carioca de Badminton 2026', slug: 'ccb-2026',
    status: 'registration_open', level: 'estadual',
    startDate: '2026-06-10', endDate: '2026-06-15',
    location: 'Arena Carioca 1', city: 'Rio de Janeiro', state: 'RJ',
  }])

  // Categorias
  const [catMS, catWS, catMD, catWD, catXD] = await db
    .insert(schema.tournamentCategories)
    .values([
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'MS', name: 'Simples Masculino A', drawType: 'single_elimination', seedCount: 4, maxEntries: 8 },
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'WS', name: 'Simples Feminino A',  drawType: 'single_elimination', seedCount: 4, maxEntries: 8 },
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'MD', name: 'Duplas Masculino A',  drawType: 'single_elimination', seedCount: 2, maxEntries: 4 },
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'WD', name: 'Duplas Feminino A',   drawType: 'single_elimination', seedCount: 2, maxEntries: 4 },
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'XD', name: 'Duplas Misto A',      drawType: 'single_elimination', seedCount: 4, maxEntries: 8 },
    ])
    .returning()

  // Inscrições usando os primeiros atletas do ranking
  const [regMS1, regMS2, regMS3, regMS4] = await db.insert(schema.tournamentRegistrations).values([
    { id: randomUUID(), categoryId: catMS.id, athleteId: males[0].id, seed: 1, confirmed: true, rankingPointsAtEntry: msPoints[0] },
    { id: randomUUID(), categoryId: catMS.id, athleteId: males[1].id, seed: 2, confirmed: true, rankingPointsAtEntry: msPoints[1] },
    { id: randomUUID(), categoryId: catMS.id, athleteId: males[2].id, seed: 3, confirmed: true, rankingPointsAtEntry: msPoints[2] },
    { id: randomUUID(), categoryId: catMS.id, athleteId: males[3].id, seed: 4, confirmed: true, rankingPointsAtEntry: msPoints[3] },
  ]).returning()

  const [regWS1, regWS2, regWS3, regWS4] = await db.insert(schema.tournamentRegistrations).values([
    { id: randomUUID(), categoryId: catWS.id, athleteId: females[0].id, seed: 1, confirmed: true, rankingPointsAtEntry: wsPoints[0] },
    { id: randomUUID(), categoryId: catWS.id, athleteId: females[1].id, seed: 2, confirmed: true, rankingPointsAtEntry: wsPoints[1] },
    { id: randomUUID(), categoryId: catWS.id, athleteId: females[2].id, seed: 3, confirmed: true, rankingPointsAtEntry: wsPoints[2] },
    { id: randomUUID(), categoryId: catWS.id, athleteId: females[3].id, seed: 4, confirmed: true, rankingPointsAtEntry: wsPoints[3] },
  ]).returning()

  const [regMD1, regMD2] = await db.insert(schema.tournamentRegistrations).values([
    { id: randomUUID(), categoryId: catMD.id, athleteId: males[0].id, athlete2Id: males[1].id, seed: 1, confirmed: true, rankingPointsAtEntry: 2600 },
    { id: randomUUID(), categoryId: catMD.id, athleteId: males[2].id, athlete2Id: males[3].id, seed: 2, confirmed: true, rankingPointsAtEntry: 2500 },
  ]).returning()

  const [regWD1, regWD2] = await db.insert(schema.tournamentRegistrations).values([
    { id: randomUUID(), categoryId: catWD.id, athleteId: females[0].id, athlete2Id: females[1].id, seed: 1, confirmed: true, rankingPointsAtEntry: 2400 },
    { id: randomUUID(), categoryId: catWD.id, athleteId: females[2].id, athlete2Id: females[3].id, seed: 2, confirmed: true, rankingPointsAtEntry: 2310 },
  ]).returning()

  const [regXD1, regXD2, regXD3, regXD4] = await db.insert(schema.tournamentRegistrations).values([
    { id: randomUUID(), categoryId: catXD.id, athleteId: males[0].id, athlete2Id: females[0].id, seed: 1, confirmed: true, rankingPointsAtEntry: 2700 },
    { id: randomUUID(), categoryId: catXD.id, athleteId: males[1].id, athlete2Id: females[1].id, seed: 2, confirmed: true, rankingPointsAtEntry: 2605 },
    { id: randomUUID(), categoryId: catXD.id, athleteId: males[2].id, athlete2Id: females[2].id, seed: 3, confirmed: true, rankingPointsAtEntry: 2510 },
    { id: randomUUID(), categoryId: catXD.id, athleteId: males[3].id, athlete2Id: females[3].id, seed: 4, confirmed: true, rankingPointsAtEntry: 2415 },
  ]).returning()

  // Chaveamentos e partidas
  const [drawMS] = await db.insert(schema.draws).values([{ id: randomUUID(), categoryId: catMS.id, published: true }]).returning()
  const [sf1] = await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawMS.id, round: 2, position: 1, registration1Id: regMS1.id, registration2Id: regMS4.id, status: 'completed' }]).returning()
  const [sf2] = await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawMS.id, round: 2, position: 2, registration1Id: regMS2.id, registration2Id: regMS3.id, status: 'completed' }]).returning()
  await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawMS.id, round: 1, position: 1, registration1Id: regMS1.id, registration2Id: regMS2.id, status: 'in_progress' }])
  await db.insert(schema.matchResults).values([
    { id: randomUUID(), matchId: sf1.id, setNumber: 1, score1: 21, score2: 15 },
    { id: randomUUID(), matchId: sf1.id, setNumber: 2, score1: 21, score2: 18 },
    { id: randomUUID(), matchId: sf2.id, setNumber: 1, score1: 21, score2: 19 },
    { id: randomUUID(), matchId: sf2.id, setNumber: 2, score1: 18, score2: 21 },
    { id: randomUUID(), matchId: sf2.id, setNumber: 3, score1: 21, score2: 17 },
  ])

  const [drawWS] = await db.insert(schema.draws).values([{ id: randomUUID(), categoryId: catWS.id, published: true }]).returning()
  const [wsSF1] = await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawWS.id, round: 2, position: 1, registration1Id: regWS1.id, registration2Id: regWS4.id, status: 'completed' }]).returning()
  const [wsSF2] = await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawWS.id, round: 2, position: 2, registration1Id: regWS2.id, registration2Id: regWS3.id, status: 'completed' }]).returning()
  await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawWS.id, round: 1, position: 1, registration1Id: regWS1.id, registration2Id: regWS2.id, status: 'pending' }])
  await db.insert(schema.matchResults).values([
    { id: randomUUID(), matchId: wsSF1.id, setNumber: 1, score1: 21, score2: 12 },
    { id: randomUUID(), matchId: wsSF1.id, setNumber: 2, score1: 21, score2: 16 },
    { id: randomUUID(), matchId: wsSF2.id, setNumber: 1, score1: 21, score2: 17 },
    { id: randomUUID(), matchId: wsSF2.id, setNumber: 2, score1: 14, score2: 21 },
    { id: randomUUID(), matchId: wsSF2.id, setNumber: 3, score1: 21, score2: 19 },
  ])

  const [drawMD] = await db.insert(schema.draws).values([{ id: randomUUID(), categoryId: catMD.id, published: true }]).returning()
  const [mdFinal] = await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawMD.id, round: 1, position: 1, registration1Id: regMD1.id, registration2Id: regMD2.id, status: 'completed' }]).returning()
  await db.insert(schema.matchResults).values([
    { id: randomUUID(), matchId: mdFinal.id, setNumber: 1, score1: 21, score2: 14 },
    { id: randomUUID(), matchId: mdFinal.id, setNumber: 2, score1: 19, score2: 21 },
    { id: randomUUID(), matchId: mdFinal.id, setNumber: 3, score1: 21, score2: 18 },
  ])

  const [drawWD] = await db.insert(schema.draws).values([{ id: randomUUID(), categoryId: catWD.id, published: true }]).returning()
  const [wdFinal] = await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawWD.id, round: 1, position: 1, registration1Id: regWD1.id, registration2Id: regWD2.id, status: 'completed' }]).returning()
  await db.insert(schema.matchResults).values([
    { id: randomUUID(), matchId: wdFinal.id, setNumber: 1, score1: 21, score2: 11 },
    { id: randomUUID(), matchId: wdFinal.id, setNumber: 2, score1: 21, score2: 15 },
  ])

  const [drawXD] = await db.insert(schema.draws).values([{ id: randomUUID(), categoryId: catXD.id, published: true }]).returning()
  const [xdSF1] = await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawXD.id, round: 2, position: 1, registration1Id: regXD1.id, registration2Id: regXD4.id, status: 'completed' }]).returning()
  const [xdSF2] = await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawXD.id, round: 2, position: 2, registration1Id: regXD2.id, registration2Id: regXD3.id, status: 'completed' }]).returning()
  await db.insert(schema.matches).values([{ id: randomUUID(), drawId: drawXD.id, round: 1, position: 1, registration1Id: regXD1.id, registration2Id: regXD2.id, status: 'pending' }])
  await db.insert(schema.matchResults).values([
    { id: randomUUID(), matchId: xdSF1.id, setNumber: 1, score1: 21, score2: 13 },
    { id: randomUUID(), matchId: xdSF1.id, setNumber: 2, score1: 21, score2: 17 },
    { id: randomUUID(), matchId: xdSF2.id, setNumber: 1, score1: 18, score2: 21 },
    { id: randomUUID(), matchId: xdSF2.id, setNumber: 2, score1: 21, score2: 15 },
    { id: randomUUID(), matchId: xdSF2.id, setNumber: 3, score1: 21, score2: 19 },
  ])

  console.log(`✅ ${allAthletes.length} atletas criados`)
  console.log(`✅ Rankings: MS(${males.length}), WS(${females.length}), MD(${mdDuos.length}), WD(${wdDuos.length}), XD(${xdDuos.length})`)
  console.log('🎉 Seed concluído!')
  await pool.end()
}

seed().catch((err) => {
  console.error('❌ Erro no seed:', err)
  process.exit(1)
})
