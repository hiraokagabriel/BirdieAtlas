#!/usr/bin/env node
// Restauração do banco local: `pnpm db:restore <arquivo.dump> --yes [--db <nome>]`.
// SUBSTITUI o conteúdo do banco pelo do arquivo. Antes, faz um backup automático do estado atual
// (backups/<banco>-...dump), para dar para voltar atrás. Sem --yes, só explica e não faz nada.

import { spawn } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { backup, parseDbArg } from './db-backup.mjs'

const args = process.argv.slice(2)
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--db')

try {
  const db = parseDbArg(args)
  if (!file || !existsSync(file)) throw new Error(`Arquivo de backup não encontrado: ${file ?? '(nenhum)'}\nUso: pnpm db:restore backups/<arquivo>.dump --yes`)
  if (!args.includes('--yes')) {
    console.log(`Isto vai SUBSTITUIR todos os dados do banco "${db}" pelos de ${file}.`)
    console.log('Um backup do estado atual é feito antes. Para confirmar, repita o comando com --yes.')
    process.exit(1)
  }

  const safety = await backup(db)
  console.log(`Backup do estado atual (para voltar atrás): ${safety}`)

  // --clean --if-exists: apaga e recria cada objeto; --single-transaction: ou restaura tudo, ou nada.
  const child = spawn(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'pg_restore', '-U', 'postgres', '-d', db, '--clean', '--if-exists', '--no-owner', '--single-transaction'],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  createReadStream(resolve(file)).pipe(child.stdin)
  const code = await new Promise((done) => child.on('close', done).on('error', () => done(-1)))
  if (code !== 0) throw new Error(`pg_restore falhou (código ${code}); nada foi alterado. O backup do estado atual está em ${safety}.`)
  console.log(`Banco "${db}" restaurado de ${file}.`)
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
