import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  date,
  real,
  jsonb,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const id = () => text('id').primaryKey().notNull()
const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}
/** Soft delete: registros de negócio nunca são apagados fisicamente (resultados e rankings dependem deles). */
const softDelete = {
  deletedAt: timestamp('deleted_at'),
}
/** Unicidade só entre registros não excluídos, para um slug/e-mail poder ser reutilizado após exclusão. */
const notDeleted = sql`deleted_at IS NULL`

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const genderEnum = pgEnum('gender', ['M', 'F'])

export const disciplineEnum = pgEnum('discipline', [
  'MS', 'WS', 'MD', 'WD', 'XD',
])

export const drawTypeEnum = pgEnum('draw_type', [
  'single_elimination', 'round_robin', 'group_then_elimination', 'swiss',
])

export const matchStatusEnum = pgEnum('match_status', [
  'pending', 'in_progress', 'completed', 'walkover', 'retired',
])

export const tournamentStatusEnum = pgEnum('tournament_status', [
  'draft', 'registration_open', 'registration_closed',
  'in_progress', 'completed', 'cancelled',
])

export const tournamentLevelEnum = pgEnum('tournament_level', [
  'local', 'regional', 'state', 'national', 'international',
])

export const rankingStatusEnum = pgEnum('ranking_status', [
  'active', 'inactive', 'archived',
])

export const registrationStatusEnum = pgEnum('registration_status', [
  'pending', 'approved', 'rejected',
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
  slug: text('slug').notNull(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  city: text('city'),
  state: text('state'),
  logoUrl: text('logo_url'),
  coverUrl: text('cover_url'),
  primaryColor: text('primary_color'),
  secondaryColor: text('secondary_color'),
  active: boolean('active').notNull().default(true),
  ...softDelete,
  ...timestamps,
}, (table) => [
  uniqueIndex('clubs_slug_unique').on(table.slug).where(notDeleted),
])

// ---------------------------------------------------------------------------
// Athletes
// ---------------------------------------------------------------------------
export const athletes = pgTable('athletes', {
  id: id(),
  name: text('name').notNull(),
  email: text('email'),
  gender: genderEnum('gender').notNull(),
  birthDate: date('birth_date'),
  nationality: text('nationality').notNull().default('BR'),
  photoUrl: text('photo_url'),
  active: boolean('active').notNull().default(true),
  ...softDelete,
  ...timestamps,
}, (table) => [
  uniqueIndex('athletes_email_unique').on(table.email).where(notDeleted),
])

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
// Pairs (Duplas)
// ---------------------------------------------------------------------------
export const pairs = pgTable('pairs', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  athlete1Id: text('athlete1_id').notNull().references(() => athletes.id),
  athlete2Id: text('athlete2_id').notNull().references(() => athletes.id),
  discipline: disciplineEnum('discipline').notNull(),
  active: boolean('active').notNull().default(true),
  ...softDelete,
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------
export const tournaments = pgTable('tournaments', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  status: tournamentStatusEnum('status').notNull().default('draft'),
  level: tournamentLevelEnum('level').notNull().default('state'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  location: text('location'),
  city: text('city'),
  state: text('state'),
  pointsAwarded: boolean('points_awarded').notNull().default(false),
  ...softDelete,
  ...timestamps,
}, (table) => [
  uniqueIndex('tournaments_slug_unique').on(table.slug).where(notDeleted),
])

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
  ...softDelete,
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Tournament Registrations
// ---------------------------------------------------------------------------
export const tournamentRegistrations = pgTable('tournament_registrations', {
  id: id(),
  categoryId: text('category_id').notNull().references(() => tournamentCategories.id),
  // Singles: athleteId. Duplas: pairId (os atletas vêm da dupla). Exatamente um dos dois.
  athleteId: text('athlete_id').references(() => athletes.id),
  pairId: text('pair_id').references(() => pairs.id),
  seed: integer('seed'),
  status: registrationStatusEnum('status').notNull().default('pending'),
  notes: text('notes'),
  rankingPointsAtEntry: integer('ranking_points_at_entry'),
  finalPlacement: integer('final_placement'),
  ...softDelete,
  ...timestamps,
}, (table) => [
  check('registrations_athlete_xor_pair', sql`(${table.athleteId} IS NULL) <> (${table.pairId} IS NULL)`),
  // Um atleta ou dupla por categoria; inscrições recusadas ou excluídas não ocupam a vaga.
  uniqueIndex('registrations_category_athlete_unique').on(table.categoryId, table.athleteId)
    .where(sql`deleted_at IS NULL AND status <> 'rejected'`),
  uniqueIndex('registrations_category_pair_unique').on(table.categoryId, table.pairId)
    .where(sql`deleted_at IS NULL AND status <> 'rejected'`),
  index('registrations_category_idx').on(table.categoryId),
  index('registrations_status_idx').on(table.status),
])

// ---------------------------------------------------------------------------
// Draws
// ---------------------------------------------------------------------------
export const draws = pgTable('draws', {
  id: id(),
  categoryId: text('category_id').notNull().references(() => tournamentCategories.id),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  published: boolean('published').notNull().default(false),
  drawMode: text('draw_mode').notNull().default('random'),
  // Configuração do formato (grupos + eliminatória: { groupCount, advancePerGroup }).
  config: jsonb('config'),
  ...timestamps,
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
  // Rótulo da fase quando não é o padrão de eliminação simples (ex.: "Rodada 3" no todos contra todos).
  roundLabel: text('round_label'),
  // Grupos + eliminatória: letra do grupo e fase da partida ('group' | 'knockout'). Nulos nos outros formatos.
  groupKey: text('group_key'),
  stage: text('stage'),
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

// ---------------------------------------------------------------------------
// Match Live States
//
// Placar provisório de uma partida em andamento: a sequência de pontos (1 ou 2 = quem
// marcou). Fica numa tabela própria, separada de match_results, para que dado provisório
// nunca seja lido como resultado por colocação, pontos, ranking ou encerramento.
// `version` sobe a cada escrita e serve de verificação otimista entre operadores.
// ---------------------------------------------------------------------------
export const matchLiveStates = pgTable('match_live_states', {
  id: id(),
  matchId: text('match_id').notNull().references(() => matches.id),
  points: jsonb('points').$type<(1 | 2)[]>().notNull().default(sql`'[]'::jsonb`),
  version: integer('version').notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex('match_live_states_match_unique').on(table.matchId),
])

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------
export const rankings = pgTable('rankings', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  discipline: disciplineEnum('discipline').notNull(),
  year: integer('year').notNull(),
  status: rankingStatusEnum('status').notNull().default('active'),
  countBestResults: integer('count_best_results'),
  minTournamentsRequired: integer('min_tournaments_required').notNull().default(0),
  isPublic: boolean('is_public').notNull().default(true),
  autoInclude: boolean('auto_include').notNull().default(false),
  lastCalculatedAt: timestamp('last_calculated_at'),
  deletedAt: timestamp('deleted_at'),
  ...timestamps,
}, (table) => [
  uniqueIndex('rankings_tenant_slug_unique').on(table.tenantId, table.slug).where(notDeleted),
])

// ---------------------------------------------------------------------------
// Point Rules
// ---------------------------------------------------------------------------
export const pointRules = pgTable('point_rules', {
  id: id(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id),
  tournamentLevel: tournamentLevelEnum('tournament_level').notNull(),
  discipline: disciplineEnum('discipline'),
  category: text('category'),
  multiplier: real('multiplier').notNull().default(1.0),
  participationBonus: real('participation_bonus').notNull().default(0),
  entries: jsonb('entries').notNull().default('[]'),
  deletedAt: timestamp('deleted_at'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Ranking Tournaments
// ---------------------------------------------------------------------------
export const rankingTournaments = pgTable('ranking_tournaments', {
  id: id(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id),
  levelOverride: tournamentLevelEnum('level_override'),
  tournamentMultiplier: real('tournament_multiplier').notNull().default(1.0),
  isScoring: boolean('is_scoring').notNull().default(true),
  notes: text('notes'),
  deletedAt: timestamp('deleted_at'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Ranking Entries
// ---------------------------------------------------------------------------
export const rankingEntries = pgTable('ranking_entries', {
  id: id(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id),
  athleteId: text('athlete_id').notNull().references(() => athletes.id),
  athlete2Id: text('athlete2_id').references(() => athletes.id),
  position: integer('position').notNull(),
  previousPosition: integer('previous_position'),
  totalPoints: real('total_points').notNull().default(0),
  tournamentsCount: integer('tournaments_count').notNull().default(0),
  resultsDetail: jsonb('results_detail').notNull().default('[]'),
  manualAdjustment: real('manual_adjustment').notNull().default(0),
  overrideReason: text('override_reason'),
  overrideByUserId: text('override_by_user_id'),
  overrideAt: timestamp('override_at'),
  calculatedAt: timestamp('calculated_at'),
  ...timestamps,
})
