import { execSync } from 'node:child_process'
import { API_URL, DATABASE_URL, REPO_ROOT, assertE2eDatabase, databaseName } from './env.js'

// Prepara o banco do E2E do zero: cria (se faltar), recria o schema pelas migrations e popula com o seed.
// Reaproveita os scripts da API (`db:create`, `db:reset`, `db:seed`). O seed tem sufixos aleatórios nos
// slugs; os testes não dependem deles (cada spec cria os próprios dados).

function run(command: string): void {
  console.log(`[e2e] ${command}`)
  execSync(command, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL, NODE_ENV: 'development' },
  })
}

export default async function globalSetup(): Promise<void> {
  assertE2eDatabase()
  console.log(`[e2e] banco de teste: ${databaseName()} (o de desenvolvimento não é tocado)`)

  run('pnpm --filter @birdie-atlas/api db:create')
  run('pnpm --filter @birdie-atlas/api db:reset')
  run('pnpm --filter @birdie-atlas/api db:seed --profile small')

  // A API sobe com o modo admin ligado; garante o estado caso o ambiente tenha outro valor.
  const res = await fetch(`${API_URL}/dev/admin-mode`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  })
  if (!res.ok) throw new Error(`Não foi possível ligar o modo admin da API de teste (${res.status}).`)

  // Confirma que a API de teste lê o banco de teste (tenant padrão cadastrado pelo seed).
  const tournaments = await fetch(`${API_URL}/tournaments?pageSize=1`)
  if (!tournaments.ok) throw new Error(`A API de teste não consegue ler o banco (${tournaments.status}).`)
}
