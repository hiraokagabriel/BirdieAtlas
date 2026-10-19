import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

// Apaga TODO o banco e recria a partir das migrations. Só para desenvolvimento local.
// Recusa produção e qualquer host que não seja local, para não destruir dados reais por engano.

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/birdie_atlas'
const host = new URL(url).hostname

if (process.env['NODE_ENV'] === 'production') {
  console.error('db:reset recusado: NODE_ENV=production.')
  process.exit(1)
}
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`db:reset recusado: o banco não é local (host "${host}").`)
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
try {
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE')
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
  await pool.query('CREATE SCHEMA public')
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  console.log(`Banco local recriado a partir das migrations (${host}).`)
} finally {
  await pool.end()
}
