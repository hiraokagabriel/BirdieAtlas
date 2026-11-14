#!/usr/bin/env node
// Restauração do banco local: `pnpm db:restore <arquivo.dump> --yes [--db <nome>]`.
// SUBSTITUI o conteúdo do banco pelo do arquivo. Antes, faz um backup automático do estado atual
// (backups/<banco>-...dump), para dar para voltar atrás. Sem --yes, só explica e não faz nada.

import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { backup, composeExec, exitCode, parseDbArg } from './db-backup.mjs'

/** Primeiro argumento que não é opção nem o valor de `--db`. */
export function parseFileArg(argv) {
  return argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--db')
}

/**
 * Script do contêiner: converte o dump em SQL num arquivo temporário (se o dump for inválido, para aqui
 * e nada muda) e só então aplica, numa transação única, apagando antes os schemas `public` e `drizzle`.
 * Apagar tudo evita sobras de um schema mais novo que o do backup (tabelas e migrations a mais).
 * `db` já foi validado por /^[a-z0-9_]+$/.
 */
export function restoreScript(db) {
  return [
    'set -e',
    'tmp=$(mktemp)',
    'trap \'rm -f "$tmp"\' EXIT',
    'pg_restore --no-owner -f "$tmp"',
    `{ echo 'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'; cat "$tmp"; } | PGOPTIONS='-c client_min_messages=warning' psql -q -U postgres -d ${db} -v ON_ERROR_STOP=1 --single-transaction > /dev/null`,
  ].join('\n')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const file = parseFileArg(args)
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

    const child = composeExec(['sh', '-c', restoreScript(db)], ['pipe', 'inherit', 'inherit'])
    // O código de saída do contêiner decide; um EPIPE (o lado de lá parou cedo) não derruba o script.
    const sent = pipeline(createReadStream(resolve(file)), child.stdin).catch(() => {})
    const [code] = await Promise.all([exitCode(child), sent])
    if (code !== 0) throw new Error(`Restauração falhou (código ${code}); o banco não foi alterado. Backup do estado atual: ${safety}`)
    console.log(`Banco "${db}" restaurado de ${file}.`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
