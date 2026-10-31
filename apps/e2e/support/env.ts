import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// `apps/e2e/.env` (ignorado pelo Git, ver `.env.example`) ajusta o E2E nesta máquina, por exemplo
// `E2E_DATABASE_URL` com outra porta do Postgres. Não sobrescreve variável já exportada.
// A barreira "e2e" no nome do banco (`assertE2eDatabase`) continua valendo.
const localEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env')
if (existsSync(localEnv)) process.loadEnvFile(localEnv)

// Configuração única do E2E: portas próprias (as do desenvolvimento são 3000 e 3001) e banco próprio.
// Tudo pode ser trocado por variável de ambiente, mas o padrão nunca encosta no ambiente de desenvolvimento.

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export const API_PORT = Number(process.env['E2E_API_PORT'] ?? 3201)
export const WEB_PORT = Number(process.env['E2E_WEB_PORT'] ?? 3200)
export const API_URL = `http://localhost:${API_PORT}`
export const WEB_URL = `http://localhost:${WEB_PORT}`

export const DATABASE_URL =
  process.env['E2E_DATABASE_URL'] ?? 'postgresql://postgres:postgres@127.0.0.1:5432/birdieatlas_e2e'

/** Mesmo tenant do `.env.example` da API; o seed o cria. */
export const TENANT_SLUG = 'fpb-sp'

/** Pasta de build do Next só do E2E (não pisa no `.next` do desenvolvimento). */
export const WEB_DIST_DIR = '.next-e2e'

export function databaseName(url: string = DATABASE_URL): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
}

/** Barreira contra apagar o banco errado: só nomes que deixam claro que são do E2E. */
export function assertE2eDatabase(url: string = DATABASE_URL): void {
  const name = databaseName(url)
  if (!/e2e/i.test(name) || name === 'birdie_atlas') {
    throw new Error(
      `E2E recusado: o banco "${name}" não parece ser de teste. Use um nome com "e2e" (padrão: birdieatlas_e2e).`,
    )
  }
}
