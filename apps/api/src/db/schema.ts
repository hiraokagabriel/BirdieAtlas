import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Função que gera IDs únicos automaticamente
const id = () => text('id').primaryKey().notNull()
const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}

// Tabela de organizações/federações
export const tenants = pgTable('tenants', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ...timestamps,
})

// Tabela de clubes
export const clubs = pgTable('clubs', {
  id: id(),
  name: text('name').notNull(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  ...timestamps,
})

// Tabela de atletas
export const athletes = pgTable('athletes', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').unique(),
  clubId: text('club_id').references(() => clubs.id),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  ...timestamps,
})