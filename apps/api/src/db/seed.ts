import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { randomUUID } from 'crypto'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/birdie_atlas',
})
const db = drizzle(pool, { schema })

async function seed() {
  console.log('🌱 Seeding database...')

  const [tenantSP, tenantRJ] = await db
    .insert(schema.tenants)
    .values([
      { id: randomUUID(), name: 'Federação Paulista de Badminton', slug: 'fpb-sp', country: 'BR' },
      { id: randomUUID(), name: 'Federação Carioca de Badminton', slug: 'fcb-rj', country: 'BR' },
    ])
    .returning()

  const [clubSP1, clubSP2, clubSP3, clubRJ1, clubRJ2, clubRJ3] = await db
    .insert(schema.clubs)
    .values([
      { id: randomUUID(), name: 'Clube Atlético Paulistano', slug: 'cap-sp', tenantId: tenantSP.id, city: 'São Paulo', state: 'SP' },
      { id: randomUUID(), name: 'Esporte Clube Pinheiros', slug: 'ecp-sp', tenantId: tenantSP.id, city: 'São Paulo', state: 'SP' },
      { id: randomUUID(), name: 'Associação Campineira de Badminton', slug: 'acb-campinas', tenantId: tenantSP.id, city: 'Campinas', state: 'SP' },
      { id: randomUUID(), name: 'Clube de Regatas do Flamengo', slug: 'crf-rj', tenantId: tenantRJ.id, city: 'Rio de Janeiro', state: 'RJ' },
      { id: randomUUID(), name: 'Botafogo de Futebol e Regatas', slug: 'bfr-rj', tenantId: tenantRJ.id, city: 'Rio de Janeiro', state: 'RJ' },
      { id: randomUUID(), name: 'Niterói Badminton Clube', slug: 'nbc-rj', tenantId: tenantRJ.id, city: 'Niterói', state: 'RJ' },
    ])
    .returning()

  const [sp1, sp2, sp3, sp4, sp5, sp6, sp7, sp8] = await db
    .insert(schema.athletes)
    .values([
      { id: randomUUID(), name: 'Lucas Tanaka', email: 'lucas.tanaka@email.com', gender: 'M', birthDate: '1998-03-15', nationality: 'BR' },
      { id: randomUUID(), name: 'Rafael Souza', email: 'rafael.souza@email.com', gender: 'M', birthDate: '2000-07-22', nationality: 'BR' },
      { id: randomUUID(), name: 'Matheus Lima', email: 'matheus.lima@email.com', gender: 'M', birthDate: '1997-11-08', nationality: 'BR' },
      { id: randomUUID(), name: 'Bruno Oliveira', email: 'bruno.oliveira@email.com', gender: 'M', birthDate: '2001-05-30', nationality: 'BR' },
      { id: randomUUID(), name: 'Ana Carolina Silva', email: 'ana.silva@email.com', gender: 'F', birthDate: '1999-09-12', nationality: 'BR' },
      { id: randomUUID(), name: 'Juliana Ferreira', email: 'juliana.ferreira@email.com', gender: 'F', birthDate: '2002-01-25', nationality: 'BR' },
      { id: randomUUID(), name: 'Camila Rocha', email: 'camila.rocha@email.com', gender: 'F', birthDate: '1996-06-18', nationality: 'BR' },
      { id: randomUUID(), name: 'Fernanda Costa', email: 'fernanda.costa@email.com', gender: 'F', birthDate: '2003-12-04', nationality: 'BR' },
    ])
    .returning()

  const [rj1, rj2, rj3, rj4, rj5, rj6, rj7, rj8] = await db
    .insert(schema.athletes)
    .values([
      { id: randomUUID(), name: 'Pedro Alves', email: 'pedro.alves@email.com', gender: 'M', birthDate: '1997-04-10', nationality: 'BR' },
      { id: randomUUID(), name: 'Gabriel Santos', email: 'gabriel.santos@email.com', gender: 'M', birthDate: '1999-08-14', nationality: 'BR' },
      { id: randomUUID(), name: 'Thiago Martins', email: 'thiago.martins@email.com', gender: 'M', birthDate: '2001-02-28', nationality: 'BR' },
      { id: randomUUID(), name: 'Diego Carvalho', email: 'diego.carvalho@email.com', gender: 'M', birthDate: '1998-10-05', nationality: 'BR' },
      { id: randomUUID(), name: 'Beatriz Nunes', email: 'beatriz.nunes@email.com', gender: 'F', birthDate: '2000-03-17', nationality: 'BR' },
      { id: randomUUID(), name: 'Larissa Mendes', email: 'larissa.mendes@email.com', gender: 'F', birthDate: '1997-07-23', nationality: 'BR' },
      { id: randomUUID(), name: 'Isabela Pereira', email: 'isabela.pereira@email.com', gender: 'F', birthDate: '2002-11-09', nationality: 'BR' },
      { id: randomUUID(), name: 'Vanessa Torres', email: 'vanessa.torres@email.com', gender: 'F', birthDate: '1995-05-31', nationality: 'BR' },
    ])
    .returning()

  await db.insert(schema.athleteAffiliations).values([
    { id: randomUUID(), athleteId: sp1.id, clubId: clubSP1.id, tenantId: tenantSP.id, startedAt: '2022-01-01', endedAt: '2024-06-30' },
    { id: randomUUID(), athleteId: sp1.id, clubId: clubSP2.id, tenantId: tenantSP.id, startedAt: '2024-07-01', endedAt: null },
    { id: randomUUID(), athleteId: sp2.id, clubId: clubSP1.id, tenantId: tenantSP.id, startedAt: '2021-03-01', endedAt: null },
    { id: randomUUID(), athleteId: sp3.id, clubId: clubSP2.id, tenantId: tenantSP.id, startedAt: '2020-08-15', endedAt: null },
    { id: randomUUID(), athleteId: sp4.id, clubId: clubSP3.id, tenantId: tenantSP.id, startedAt: '2023-02-10', endedAt: null },
    { id: randomUUID(), athleteId: sp5.id, clubId: clubSP1.id, tenantId: tenantSP.id, startedAt: '2019-05-20', endedAt: null },
    { id: randomUUID(), athleteId: sp6.id, clubId: clubSP2.id, tenantId: tenantSP.id, startedAt: '2022-09-01', endedAt: null },
    { id: randomUUID(), athleteId: sp7.id, clubId: clubSP3.id, tenantId: tenantSP.id, startedAt: '2021-11-15', endedAt: null },
    { id: randomUUID(), athleteId: sp8.id, clubId: clubSP1.id, tenantId: tenantSP.id, startedAt: '2023-07-01', endedAt: null },
    { id: randomUUID(), athleteId: rj1.id, clubId: clubRJ1.id, tenantId: tenantRJ.id, startedAt: '2020-01-15', endedAt: null },
    { id: randomUUID(), athleteId: rj2.id, clubId: clubRJ1.id, tenantId: tenantRJ.id, startedAt: '2021-06-01', endedAt: null },
    { id: randomUUID(), athleteId: rj3.id, clubId: clubRJ2.id, tenantId: tenantRJ.id, startedAt: '2022-03-10', endedAt: null },
    { id: randomUUID(), athleteId: rj4.id, clubId: clubRJ2.id, tenantId: tenantRJ.id, startedAt: '2020-09-20', endedAt: null },
    { id: randomUUID(), athleteId: rj5.id, clubId: clubRJ3.id, tenantId: tenantRJ.id, startedAt: '2023-01-05', endedAt: null },
    { id: randomUUID(), athleteId: rj6.id, clubId: clubRJ1.id, tenantId: tenantRJ.id, startedAt: '2019-04-12', endedAt: null },
    { id: randomUUID(), athleteId: rj7.id, clubId: clubRJ3.id, tenantId: tenantRJ.id, startedAt: '2022-07-30', endedAt: null },
    { id: randomUUID(), athleteId: rj8.id, clubId: clubRJ2.id, tenantId: tenantRJ.id, startedAt: '2021-10-01', endedAt: null },
  ])

  const [ptSP] = await db
    .insert(schema.pointsTables)
    .values([{ id: randomUUID(), tenantId: tenantSP.id, name: 'Tabela Estadual SP 2026', tournamentLevel: 'estadual', placement: 1, points: 1000 }])
    .returning()

  await db.insert(schema.pointsTables).values([
    { id: randomUUID(), tenantId: tenantSP.id, name: 'Tabela Estadual SP 2026', tournamentLevel: 'estadual', placement: 2, points: 700 },
    { id: randomUUID(), tenantId: tenantSP.id, name: 'Tabela Estadual SP 2026', tournamentLevel: 'estadual', placement: 3, points: 500 },
    { id: randomUUID(), tenantId: tenantSP.id, name: 'Tabela Estadual SP 2026', tournamentLevel: 'estadual', placement: 4, points: 500 },
    { id: randomUUID(), tenantId: tenantSP.id, name: 'Tabela Estadual SP 2026', tournamentLevel: 'estadual', placement: 5, points: 300 },
    { id: randomUUID(), tenantId: tenantSP.id, name: 'Tabela Estadual SP 2026', tournamentLevel: 'estadual', placement: 8, points: 200 },
  ])

  const [rankMS, rankWS, rankMD, rankWD, rankXD] = await db
    .insert(schema.rankings)
    .values([
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Simples Masculino A', discipline: 'MS', year: 2026 },
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Simples Feminino A', discipline: 'WS', year: 2026 },
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Duplas Masculino A', discipline: 'MD', year: 2026 },
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Duplas Feminino A', discipline: 'WD', year: 2026 },
      { id: randomUUID(), tenantId: tenantSP.id, name: 'Duplas Misto A', discipline: 'XD', year: 2026 },
    ])
    .returning()

  await db.insert(schema.rankingEntries).values([
    { id: randomUUID(), rankingId: rankMS.id, athleteId: sp1.id, points: 2400, position: 1 },
    { id: randomUUID(), rankingId: rankMS.id, athleteId: sp2.id, points: 1800, position: 2 },
    { id: randomUUID(), rankingId: rankMS.id, athleteId: sp3.id, points: 1200, position: 3 },
    { id: randomUUID(), rankingId: rankMS.id, athleteId: sp4.id, points: 800, position: 4 },
    { id: randomUUID(), rankingId: rankWS.id, athleteId: sp5.id, points: 2100, position: 1 },
    { id: randomUUID(), rankingId: rankWS.id, athleteId: sp6.id, points: 1600, position: 2 },
    { id: randomUUID(), rankingId: rankWS.id, athleteId: sp7.id, points: 1100, position: 3 },
    { id: randomUUID(), rankingId: rankWS.id, athleteId: sp8.id, points: 600, position: 4 },
    { id: randomUUID(), rankingId: rankMD.id, athleteId: sp1.id, athlete2Id: sp2.id, points: 1900, position: 1 },
    { id: randomUUID(), rankingId: rankMD.id, athleteId: sp3.id, athlete2Id: sp4.id, points: 1300, position: 2 },
    { id: randomUUID(), rankingId: rankWD.id, athleteId: sp5.id, athlete2Id: sp6.id, points: 1700, position: 1 },
    { id: randomUUID(), rankingId: rankWD.id, athleteId: sp7.id, athlete2Id: sp8.id, points: 900, position: 2 },
    { id: randomUUID(), rankingId: rankXD.id, athleteId: sp1.id, athlete2Id: sp5.id, points: 2000, position: 1 },
    { id: randomUUID(), rankingId: rankXD.id, athleteId: sp2.id, athlete2Id: sp6.id, points: 1400, position: 2 },
    { id: randomUUID(), rankingId: rankXD.id, athleteId: sp3.id, athlete2Id: sp7.id, points: 800, position: 3 },
    { id: randomUUID(), rankingId: rankXD.id, athleteId: sp4.id, athlete2Id: sp8.id, points: 400, position: 4 },
  ])

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

  // Categorias com discipline + name livre
  const [catMS, catWS, catMD, catWD, catXD] = await db
    .insert(schema.tournamentCategories)
    .values([
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'MS', name: 'Simples Masculino A', drawType: 'single_elimination', seedCount: 4, maxEntries: 8 },
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'WS', name: 'Simples Feminino A', drawType: 'single_elimination', seedCount: 4, maxEntries: 8 },
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'MD', name: 'Duplas Masculino A', drawType: 'single_elimination', seedCount: 2, maxEntries: 4 },
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'WD', name: 'Duplas Feminino A', drawType: 'single_elimination', seedCount: 2, maxEntries: 4 },
      { id: randomUUID(), tournamentId: tournSP.id, discipline: 'XD', name: 'Duplas Misto A', drawType: 'single_elimination', seedCount: 4, maxEntries: 8 },
    ])
    .returning()

  const [regMS1, regMS2, regMS3, regMS4] = await db
    .insert(schema.tournamentRegistrations)
    .values([
      { id: randomUUID(), categoryId: catMS.id, athleteId: sp1.id, seed: 1, confirmed: true, rankingPointsAtEntry: 2400 },
      { id: randomUUID(), categoryId: catMS.id, athleteId: sp2.id, seed: 2, confirmed: true, rankingPointsAtEntry: 1800 },
      { id: randomUUID(), categoryId: catMS.id, athleteId: sp3.id, seed: 3, confirmed: true, rankingPointsAtEntry: 1200 },
      { id: randomUUID(), categoryId: catMS.id, athleteId: sp4.id, seed: 4, confirmed: true, rankingPointsAtEntry: 800 },
    ])
    .returning()

  const [regWS1, regWS2, regWS3, regWS4] = await db
    .insert(schema.tournamentRegistrations)
    .values([
      { id: randomUUID(), categoryId: catWS.id, athleteId: sp5.id, seed: 1, confirmed: true, rankingPointsAtEntry: 2100 },
      { id: randomUUID(), categoryId: catWS.id, athleteId: sp6.id, seed: 2, confirmed: true, rankingPointsAtEntry: 1600 },
      { id: randomUUID(), categoryId: catWS.id, athleteId: sp7.id, seed: 3, confirmed: true, rankingPointsAtEntry: 1100 },
      { id: randomUUID(), categoryId: catWS.id, athleteId: sp8.id, seed: 4, confirmed: true, rankingPointsAtEntry: 600 },
    ])
    .returning()

  const [regMD1, regMD2] = await db
    .insert(schema.tournamentRegistrations)
    .values([
      { id: randomUUID(), categoryId: catMD.id, athleteId: sp1.id, athlete2Id: sp2.id, seed: 1, confirmed: true, rankingPointsAtEntry: 1900 },
      { id: randomUUID(), categoryId: catMD.id, athleteId: sp3.id, athlete2Id: sp4.id, seed: 2, confirmed: true, rankingPointsAtEntry: 1300 },
    ])
    .returning()

  const [regWD1, regWD2] = await db
    .insert(schema.tournamentRegistrations)
    .values([
      { id: randomUUID(), categoryId: catWD.id, athleteId: sp5.id, athlete2Id: sp6.id, seed: 1, confirmed: true, rankingPointsAtEntry: 1700 },
      { id: randomUUID(), categoryId: catWD.id, athleteId: sp7.id, athlete2Id: sp8.id, seed: 2, confirmed: true, rankingPointsAtEntry: 900 },
    ])
    .returning()

  const [regXD1, regXD2, regXD3, regXD4] = await db
    .insert(schema.tournamentRegistrations)
    .values([
      { id: randomUUID(), categoryId: catXD.id, athleteId: sp1.id, athlete2Id: sp5.id, seed: 1, confirmed: true, rankingPointsAtEntry: 2000 },
      { id: randomUUID(), categoryId: catXD.id, athleteId: sp2.id, athlete2Id: sp6.id, seed: 2, confirmed: true, rankingPointsAtEntry: 1400 },
      { id: randomUUID(), categoryId: catXD.id, athleteId: sp3.id, athlete2Id: sp7.id, seed: 3, confirmed: true, rankingPointsAtEntry: 800 },
      { id: randomUUID(), categoryId: catXD.id, athleteId: sp4.id, athlete2Id: sp8.id, seed: 4, confirmed: true, rankingPointsAtEntry: 400 },
    ])
    .returning()

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

  console.log('🎉 Seed concluído com sucesso!')
  await pool.end()
}

seed().catch((err) => {
  console.error('❌ Erro no seed:', err)
  process.exit(1)
})
