// `pnpm test:scripts` (também no CI) — argumentos e nomes dos scripts de backup (sem Docker).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { backupFileName, parseDbArg } from './db-backup.mjs'
import { parseFileArg, restoreScript } from './db-restore.mjs'

test('parseDbArg: padrão, --db e nome inválido', () => {
  assert.equal(parseDbArg([]), 'birdie_atlas')
  assert.equal(parseDbArg(['--db', 'birdieatlas_e2e']), 'birdieatlas_e2e')
  assert.throws(() => parseDbArg(['--db', 'x;drop']), /inválido/)
  assert.throws(() => parseDbArg(['--db']), /inválido/)
})

test('backupFileName: banco e data local com segundos', () => {
  assert.equal(backupFileName('birdie_atlas', new Date(2026, 10, 14, 2, 5, 9)), 'birdie_atlas-2026-11-14_020509.dump')
})

test('parseFileArg: ignora opções e o valor de --db', () => {
  assert.equal(parseFileArg(['--db', 'x', 'backups/a.dump', '--yes']), 'backups/a.dump')
  assert.equal(parseFileArg(['--yes']), undefined)
})

test('restoreScript: só aplica depois de converter o dump, numa transação, apagando os schemas', () => {
  const script = restoreScript('birdie_atlas')
  assert.match(script, /^set -e/)
  assert.ok(script.indexOf('pg_restore') < script.indexOf('psql'))
  assert.match(script, /DROP SCHEMA IF EXISTS public CASCADE/)
  assert.match(script, /--single-transaction/)
  assert.match(script, /ON_ERROR_STOP=1/)
})
