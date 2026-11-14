#!/usr/bin/env node
// Backup do banco local: `pnpm db:backup [--db <nome>]`.
// Roda pg_dump dentro do contêiner do docker compose (não precisa de Postgres instalado no Windows)
// e grava backups/<banco>-AAAA-MM-DD_HHMMSS.dump (formato custom, para pg_restore).
// O arquivo contém dados pessoais de atletas: a pasta backups/ é ignorada pelo Git.

import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BACKUP_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)), 'backups')
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

/** Faz o dump e devolve o caminho do arquivo. Em falha, apaga o arquivo parcial e lança erro. */
export async function backup(db) {
  mkdirSync(BACKUP_DIR, { recursive: true })
  const file = join(BACKUP_DIR, backupFileName(db))
  const out = createWriteStream(file)
  const child = spawn('docker', ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'postgres', '-Fc', db], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  child.stdout.pipe(out)
  const code = await new Promise((done) => child.on('close', done).on('error', () => done(-1)))
  await new Promise((done) => out.close(done))
  if (code !== 0 || statSync(file).size === 0) {
    unlinkSync(file)
    throw new Error(`pg_dump falhou (código ${code}). O Postgres está de pé? Rode: docker compose up -d`)
  }
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
