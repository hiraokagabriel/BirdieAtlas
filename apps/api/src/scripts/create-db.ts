import 'dotenv/config'
import { Pool } from 'pg'

// Cria o banco apontado por DATABASE_URL quando ele ainda não existe (não toca em banco existente).
// Conecta ao banco de manutenção `postgres` do mesmo servidor. Só para servidores locais.
// Usado pelo setup do E2E (apps/e2e), que mantém um banco próprio separado do de desenvolvimento.

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/birdie_atlas'
const parsed = new URL(url)
const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))

if (process.env['NODE_ENV'] === 'production') {
  console.error('db:create recusado: NODE_ENV=production.')
  process.exit(1)
}
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)) {
  console.error(`db:create recusado: o banco não é local (host "${parsed.hostname}").`)
  process.exit(1)
}
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  console.error(`db:create recusado: nome de banco inválido "${dbName}".`)
  process.exit(1)
}

const maintenance = new URL(url)
maintenance.pathname = '/postgres'
const pool = new Pool({ connectionString: maintenance.toString() })
try {
  const exists = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
  if (exists.rowCount === 0) {
    // Identificadores não aceitam parâmetro; o nome já foi validado acima.
    await pool.query(`CREATE DATABASE "${dbName}"`)
    console.log(`Banco "${dbName}" criado.`)
  } else {
    console.log(`Banco "${dbName}" já existe.`)
  }
} finally {
  await pool.end()
}
