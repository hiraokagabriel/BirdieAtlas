import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  date,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const id = () => text('id').primaryKey().notNull()
const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const genderEnum = pgEnum('gender', ['M', 'F'])

export const categoryTypeEnum = pgEnum('category_type', [
  'MS', // Men's Singles
  'WS', // Women's Singles
  'MD', // Men's Doubles
  'WD', // Women's Doubles
  'XD', // Mixed Doubles
])

export const drawTypeEnum = pgEnum('draw_type', [
  'single_elimination',
  'round_robin',
  'group_then_elimination',
])

export const matchStatusEnum = pgEnum('match_status', [
  'pending',
  'in_progress',
  'completed',
  'walkover',
  'retired',
])

export const tournamentStatusEnum = pgEnum('tournament_status', [
  'draft',
  'registration_open',
  'registration_closed',
  'in_progress',
  'completed',
  'cancelled',
])

// ---------------------------------------------------------------------------
// Tenants (federações)
// ---------------------------------------------------------------------------
export const tenants = pgTable('tenants', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  country: text('country').notNull().default('BR'),
  logoUrl: text('logo_url'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------
export const clubs = pgTable('clubs', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  city: text('city'),
  state: text('state'),
  logoUrl: text('logo_url'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Athletes
// ---------------------------------------------------------------------------
export const athletes = pgTable('athletes', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').unique(),
  gender: genderEnum('gender').notNull(),
  birthDate: date('birth_date'),
  nationality: text('nationality').notNull().default('BR'),
  photoUrl: text('photo_url'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Athlete Affiliations
// Histórico completo de vínculos atleta <-> clube <-> federação
// Resultados de partidas devem ser analisados com a afiliação vigente
// na data da partida (matchDate between startedAt and endedAt)
// ---------------------------------------------------------------------------
export const athleteAffiliations = pgTable('athlete_affiliations', {
  id: id(),
  athleteId: text('athlete_id').notNull().references(() => athletes.id),
  clubId: text('club_id').notNull().references(() => clubs.id),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  startedAt: date('started_at').notNull(),
  endedAt: date('ended_at'), // null = afiliação atual
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------
export const rankings = pgTable('rankings', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),          // ex: "Ranking Nacional 2026"
  categoryType: categoryTypeEnum('category_type').notNull(),
  year: integer('year').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
})

export const rankingEntries = pgTable('ranking_entries', {
  id: id(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id),
  athleteId: text('athlete_id').notNull().references(() => athletes.id),
  // Para duplas, athlete2Id é preenchido
  athlete2Id: text('athlete2_id').references(() => athletes.id),
  points: integer('points').notNull().default(0),
  position: integer('position').notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Points Table
// Define quantos pontos cada colocação vale por nível de torneio
// ---------------------------------------------------------------------------
export const pointsTables = pgTable('points_tables', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),          // ex: "Tabela Estadual 2026"
  tournamentLevel: text('tournament_level').notNull(), // ex: "nacional", "estadual"
  placement: integer('placement').notNull(), // 1 = campeão, 2 = vice, etc.
  points: integer('points').notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------
export const tournaments = pgTable('tournaments', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: tournamentStatusEnum('status').notNull().default('draft'),
  level: text('level').notNull().default('estadual'), // estadual, nacional, etc.
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  location: text('location'),
  city: text('city'),
  state: text('state'),
  pointsTableId: text('points_table_id').references(() => pointsTables.id),
  rankingId: text('ranking_id').references(() => rankings.id), // ranking que será atualizado
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Tournament Categories
// Cada torneio pode ter múltiplas categorias (MS, WS, MD, etc.)
// ---------------------------------------------------------------------------
export const tournamentCategories = pgTable('tournament_categories', {
  id: id(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id),
  categoryType: categoryTypeEnum('category_type').notNull(),
  drawType: drawTypeEnum('draw_type').notNull().default('single_elimination'),
  maxEntries: integer('max_entries'),
  seedCount: integer('seed_count').notNull().default(4),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Tournament Registrations
// Inscrição de atleta(s) numa categoria de torneio
// ---------------------------------------------------------------------------
export const tournamentRegistrations = pgTable('tournament_registrations', {
  id: id(),
  categoryId: text('category_id').notNull().references(() => tournamentCategories.id),
  athleteId: text('athlete_id').notNull().references(() => athletes.id),
  athlete2Id: text('athlete2_id').references(() => athletes.id), // duplas
  seed: integer('seed'),            // null = não-cabeça de chave
  confirmed: boolean('confirmed').notNull().default(false),
  withdrew: boolean('withdrew').notNull().default(false),
  rankingPointsAtEntry: integer('ranking_points_at_entry'), // snapshot do ranking na inscrição
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Draws (Chaveamentos)
// ---------------------------------------------------------------------------
export const draws = pgTable('draws', {
  id: id(),
  categoryId: text('category_id').notNull().references(() => tournamentCategories.id),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  published: boolean('published').notNull().default(false),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------
export const matches = pgTable('matches', {
  id: id(),
  drawId: text('draw_id').notNull().references(() => draws.id),
  round: integer('round').notNull(),   // 1 = final, 2 = semifinal, etc.
  position: integer('position').notNull(), // posição dentro do round
  registration1Id: text('registration1_id').references(() => tournamentRegistrations.id),
  registration2Id: text('registration2_id').references(() => tournamentRegistrations.id),
  nextMatchId: text('next_match_id'),  // self-reference resolvida via app logic
  status: matchStatusEnum('status').notNull().default('pending'),
  scheduledAt: timestamp('scheduled_at'),
  courtNumber: integer('court_number'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Match Results
// Um resultado por set
// ---------------------------------------------------------------------------
export const matchResults = pgTable('match_results', {
  id: id(),
  matchId: text('match_id').notNull().references(() => matches.id),
  setNumber: integer('set_number').notNull(), // 1, 2, 3
  score1: integer('score1').notNull(),        // pontos do registration1
  score2: integer('score2').notNull(),        // pontos do registration2
  ...timestamps,
})
