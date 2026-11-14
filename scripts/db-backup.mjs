#!/usr/bin/env node
// Backup do banco local: `pnpm db:backup [--db <nome>]`.
// Roda pg_dump dentro do contêiner do docker compose (não precisa de Postgres instalado no Windows)
// e grava backups/<banco>-AAAA-MM-DD_HHMMSS.dump (formato custom, para pg_restore).
// O arquivo contém dados pessoais de atletas: a pasta backups/ é ignorada pelo Git.

import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Raiz do repositório: o `docker compose` acha o docker-compose.yml por ela, de onde quer que o script rode. */
export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const BACKUP_DIR = join(REPO_ROOT, 'backups')
const DB_NAME = /^[a-z0-9_]+$/

export function parseDbArg(argv, fallback = 'birdie_atlas') {
  const i = argv.indexOf('--db')
  const db = i >= 0 ? argv[i + 1] : fallback
  if (!db || !DB_NAME.test(db)) throw new Error(`Nome de banco inválido: ${db ?? '(vazio)'}`)
  return db
}

export function backupFileName(db, date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${db}-${stamp}.dump`
}

/** `docker compose exec -T postgres <comando>` a partir da raiz do repositório. */
export function composeExec(command, stdio) {
  return spawn('docker', ['compose', 'exec', '-T', 'postgres', ...command], { cwd: REPO_ROOT, stdio })
}

export const exitCode = (child) => new Promise((done) => child.on('close', done).on('error', () => done(-1)))

/**
 * Faz o dump e devolve o caminho do arquivo. Grava em `.partial` e só renomeia se o pg_dump terminar bem,
 * para um dump interrompido nunca parecer válido. Nunca sobrescreve um backup existente.
 */
export async function backup(db) {
  mkdirSync(BACKUP_DIR, { recursive: true })
  const file = join(BACKUP_DIR, backupFileName(db))
  const partial = `${file}.partial`
  const out = createWriteStream(partial, { flags: 'wx' })
  await new Promise((ready, fail) => out.once('open', ready).once('error', fail))
  const child = composeExec(['pg_dump', '-U', 'postgres', '-Fc', db], ['ignore', 'pipe', 'inherit'])
  child.stdout.pipe(out)
  const code = await exitCode(child)
  await new Promise((done) => out.close(done))
  if (code !== 0 || statSync(partial).size === 0) {
    unlinkSync(partial)
    throw new Error(`pg_dump falhou (código ${code}). O Postgres está de pé? Rode: docker compose up -d`)
  }
  renameSync(partial, file)
  return file
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const file = await backup(parseDbArg(process.argv.slice(2)))
    console.log(`Backup gravado: ${file} (${Math.round(statSync(file).size / 1024)} KB)`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
