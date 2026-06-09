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

export const disciplineEnum = pgEnum('discipline', [
  'MS', 'WS', 'MD', 'WD', 'XD',
])

export const drawTypeEnum = pgEnum('draw_type', [
  'single_elimination', 'round_robin', 'group_then_elimination',
])

export const matchStatusEnum = pgEnum('match_status', [
  'pending', 'in_progress', 'completed', 'walkover', 'retired',
])

export const tournamentStatusEnum = pgEnum('tournament_status', [
  'draft', 'registration_open', 'registration_closed',
  'in_progress', 'completed', 'cancelled',
])

// ---------------------------------------------------------------------------
// Tenants
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
  coverUrl: text('cover_url'),
  primaryColor: text('primary_color'),
  secondaryColor: text('secondary_color'),
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
// ---------------------------------------------------------------------------
export const athleteAffiliations = pgTable('athlete_affiliations', {
  id: id(),
  athleteId: text('athlete_id').notNull().references(() => athletes.id),
  clubId: text('club_id').notNull().references(() => clubs.id),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  startedAt: date('started_at').notNull(),
  endedAt: date('ended_at'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------
export const rankings = pgTable('rankings', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  discipline: disciplineEnum('discipline').notNull(),
  year: integer('year').notNull(),
  // autoInclude: se true, todos os torneios do tenant com pointsAwarded=true
  // entram automaticamente ao rodar award-points (comportamento legado)
  // se false, apenas torneios explicitamente vinculados em rankingTournaments
  autoInclude: boolean('auto_include').notNull().default(true),
  active: boolean('active').notNull().default(true),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Ranking <-> Tournament join table
// Usado quando autoInclude = false para controle granular
// ---------------------------------------------------------------------------
export const rankingTournaments = pgTable('ranking_tournaments', {
  id: id(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id),
  ...timestamps,
})

export const rankingEntries = pgTable('ranking_entries', {
  id: id(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id),
  athleteId: text('athlete_id').notNull().references(() => athletes.id),
  athlete2Id: text('athlete2_id').references(() => athletes.id),
  points: integer('points').notNull().default(0),
  position: integer('position').notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Points Table
// ---------------------------------------------------------------------------
export const pointsTables = pgTable('points_tables', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  tournamentLevel: text('tournament_level').notNull(),
  placement: integer('placement').notNull(),
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
  level: text('level').notNull().default('estadual'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  location: text('location'),
  city: text('city'),
  state: text('state'),
  pointsTableId: text('points_table_id').references(() => pointsTables.id),
  rankingId: text('ranking_id').references(() => rankings.id),
  pointsAwarded: boolean('points_awarded').notNull().default(false),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Tournament Categories
// ---------------------------------------------------------------------------
export const tournamentCategories = pgTable('tournament_categories', {
  id: id(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id),
  discipline: disciplineEnum('discipline').notNull(),
  name: text('name').notNull(),
  drawType: drawTypeEnum('draw_type').notNull().default('single_elimination'),
  maxEntries: integer('max_entries'),
  seedCount: integer('seed_count').notNull().default(4),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Tournament Registrations
// ---------------------------------------------------------------------------
export const tournamentRegistrations = pgTable('tournament_registrations', {
  id: id(),
  categoryId: text('category_id').notNull().references(() => tournamentCategories.id),
  athleteId: text('athlete_id').notNull().references(() => athletes.id),
  athlete2Id: text('athlete2_id').references(() => athletes.id),
  seed: integer('seed'),
  confirmed: boolean('confirmed').notNull().default(false),
  withdrew: boolean('withdrew').notNull().default(false),
  rankingPointsAtEntry: integer('ranking_points_at_entry'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Draws
// ---------------------------------------------------------------------------
export const draws = pgTable('draws', {
  id: id(),
  categoryId: text('category_id').notNull().references(() => tournamentCategories.id),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  published: boolean('published').notNull().default(false),
  ...timestamps,
  drawMode: text('draw_mode').notNull().default('seeded'),
})

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------
export const matches = pgTable('matches', {
  id: id(),
  drawId: text('draw_id').notNull().references(() => draws.id),
  round: integer('round').notNull(),
  position: integer('position').notNull(),
  registration1Id: text('registration1_id').references(() => tournamentRegistrations.id),
  registration2Id: text('registration2_id').references(() => tournamentRegistrations.id),
  nextMatchId: text('next_match_id'),
  status: matchStatusEnum('status').notNull().default('pending'),
  scheduledAt: timestamp('scheduled_at'),
  courtNumber: integer('court_number'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Match Results
// ---------------------------------------------------------------------------
export const matchResults = pgTable('match_results', {
  id: id(),
  matchId: text('match_id').notNull().references(() => matches.id),
  setNumber: integer('set_number').notNull(),
  score1: integer('score1').notNull(),
  score2: integer('score2').notNull(),
  ...timestamps,
})
