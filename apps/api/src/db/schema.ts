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

// Nível do torneio — usado pelo motor de ranking para selecionar a PointRule correta
export const tournamentLevelEnum = pgEnum('tournament_level', [
  'local', 'regional', 'state', 'national', 'international',
])

// Status de um ranking
export const rankingStatusEnum = pgEnum('ranking_status', [
  'active', 'inactive', 'archived',
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
// Tournaments
// ---------------------------------------------------------------------------
export const tournaments = pgTable('tournaments', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: tournamentStatusEnum('status').notNull().default('draft'),
  // Nível do torneio para fins de ranking. O motor usa este valor para
  // encontrar a PointRule correta (pode ser sobrescrito por rankingTournaments.levelOverride)
  level: tournamentLevelEnum('level').notNull().default('state'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  location: text('location'),
  city: text('city'),
  state: text('state'),
  pointsTableId: text('points_table_id').references(() => pointsTables.id),
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
  // Colocação final neste evento — preenchida ao encerrar o torneio.
  // É o campo que o motor de ranking lê para calcular pontos.
  finalPlacement: integer('final_placement'),
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
  drawMode: text('draw_mode').notNull().default('random'),
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
// Points Table (legado — mantido para compatibilidade com award-points)
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
// Rankings
//
// Um ranking é definido por: tenant + discipline + year + slug.
// Cada ranking possui PointRules (granulares por nível/disciplina/categoria)
// e torneios vinculados via RankingTournaments.
// ---------------------------------------------------------------------------
export const rankings = pgTable('rankings', {
  id: id(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),

  // Identificadores
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),

  // Escopo
  discipline: disciplineEnum('discipline').notNull(),
  year: integer('year').notNull(),

  // Configuração do motor
  status: rankingStatusEnum('status').notNull().default('active'),

  // Contar apenas os N melhores resultados de cada atleta na temporada.
  // NULL = contar todos.
  countBestResults: integer('count_best_results'),

  // Número mínimo de torneios que o atleta deve ter participado
  // para aparecer no ranking. 0 = sem mínimo.
  minTournamentsRequired: integer('min_tournaments_required').notNull().default(0),

  // Se true, visível na página pública do tenant.
  isPublic: boolean('is_public').notNull().default(true),

  // autoInclude: comportamento legado — quando true todos os torneios
  // do tenant com pointsAwarded=true entram automaticamente.
  // Quando false, apenas os vínculos explícitos em ranking_tournaments contam.
  autoInclude: boolean('auto_include').notNull().default(false),

  // Timestamp da última vez que o motor recalculou.
  lastCalculatedAt: timestamp('last_calculated_at'),

  deletedAt: timestamp('deleted_at'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Point Rules
//
// Define quantos pontos cada colocação vale dentro de um contexto:
//   rankingId + tournamentLevel + discipline (opt) + category (opt)
//
// Resolução de prioridade (mais específico ganha):
//   1. level + discipline + category  → regra exata
//   2. level + discipline             → sem categoria
//   3. level                          → só pelo nível
//   4. fallback                       → nenhum filtro adicional (level = null)
// ---------------------------------------------------------------------------
export const pointRules = pgTable('point_rules', {
  id: id(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id),

  // Nível do torneio ao qual esta regra se aplica
  tournamentLevel: tournamentLevelEnum('tournament_level').notNull(),

  // NULL = aplica a todas as disciplinas deste ranking
  discipline: disciplineEnum('discipline'),

  // NULL = aplica a todas as categorias (ex: 'Open', 'Sub-19', 'Sub-23')
  category: text('category'),

  // Fator multiplicador sobre os pontos base.
  // 1.5 = este contexto vale 50% a mais que o basePoints da tabela.
  multiplier: real('multiplier').notNull().default(1.0),

  // Bônus fixo de participação (somado independente da colocação).
  participationBonus: real('participation_bonus').notNull().default(0),

  // Tabela colocação → pontos base.
  // Formato JSON: [{ "placement": 1, "basePoints": 1000 }, { "placement": 2, "basePoints": 800 }, ...]
  entries: jsonb('entries').notNull().default('[]'),

  deletedAt: timestamp('deleted_at'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Ranking Tournaments
//
// Vínculo explícito entre um ranking e um torneio.
// Permite sobrescrever o nível e aplicar um multiplicador extra por edição.
// ---------------------------------------------------------------------------
export const rankingTournaments = pgTable('ranking_tournaments', {
  id: id(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id),

  // Sobrescreve tournament.level para fins de cálculo neste ranking.
  // NULL = usa o nível original do torneio.
  levelOverride: tournamentLevelEnum('level_override'),

  // Multiplicador extra desta edição do torneio.
  // Combina multiplicativamente com pointRules.multiplier.
  // Ex: 1.2 = esta edição vale 20% a mais.
  tournamentMultiplier: real('tournament_multiplier').notNull().default(1.0),

  // Se false, o torneio está na lista mas NÃO entra no cálculo.
  isScoring: boolean('is_scoring').notNull().default(true),

  notes: text('notes'),
  deletedAt: timestamp('deleted_at'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Ranking Entries
//
// Uma posição no ranking para um atleta ou dupla.
// Sempre gerada (ou regerada) pelo motor de recálculo.
// Pode ter ajuste manual com trilha de auditoria.
// ---------------------------------------------------------------------------
export const rankingEntries = pgTable('ranking_entries', {
  id: id(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id),
  athleteId: text('athlete_id').notNull().references(() => athletes.id),
  // Para duplas, ID do segundo atleta
  athlete2Id: text('athlete2_id').references(() => athletes.id),

  position: integer('position').notNull(),
  previousPosition: integer('previous_position'),

  // Soma total dos pontos após aplicar countBestResults + manualAdjustment
  totalPoints: real('total_points').notNull().default(0),

  // Quantos torneios o atleta participou neste ranking
  tournamentsCount: integer('tournaments_count').notNull().default(0),

  // Detalhamento de cada resultado que compõe a pontuação.
  // Formato: Array<{ tournamentId, tournamentName, placement, basePoints,
  //                  multiplier, tournamentMultiplier, finalPoints, counted }>
  resultsDetail: jsonb('results_detail').notNull().default('[]'),

  // Ajuste manual adicionado por um admin (pode ser negativo)
  manualAdjustment: real('manual_adjustment').notNull().default(0),

  // Trilha de auditoria do ajuste manual
  overrideReason: text('override_reason'),
  overrideByUserId: text('override_by_user_id'),
  overrideAt: timestamp('override_at'),

  // Quando este entry foi calculado pelo motor
  calculatedAt: timestamp('calculated_at'),

  ...timestamps,
})
