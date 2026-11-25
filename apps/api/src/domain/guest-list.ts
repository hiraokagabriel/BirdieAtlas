// Jogadores avulsos do torneio amistoso: atletas criados só com o nome (sem cadastro completo), marcados
// `athletes.guest`. Regra pura: ler a lista colada por categoria e decidir qual avulso existente reaproveitar.
import { isDoublesDiscipline } from './eligibility.js'
import { fold, type Gender } from './tournament-import.js'

export const GUEST_LIST_MAX_LINES = 256
export const GUEST_NAME_MAX = 120
const MIN_BIRTH_YEAR = 1900

export interface GuestPlayer {
  name: string
  /** Ano opcional, escrito entre parênteses ("Ana Souza (2001)"): desempata homônimos. */
  birthYear: number | null
  gender: Gender
}

export interface GuestEntry {
  /** Linha da lista (1 = primeira), para apontar o erro. */
  line: number
  players: GuestPlayer[]
}

export interface GuestListError {
  line: number
  message: string
}

/**
 * Gênero de cada lado pela disciplina: simples e dupla masculina = M, feminina = F; na mista, o 1º nome é o homem
 * e o 2º a mulher ("Carlos / Ana").
 */
export function gendersForDiscipline(discipline: string): Gender[] {
  switch (discipline) {
    case 'MS': return ['M']
    case 'WS': return ['F']
    case 'MD': return ['M', 'M']
    case 'WD': return ['F', 'F']
    case 'XD': return ['M', 'F']
    default: throw new Error(`Disciplina desconhecida: ${discipline}`)
  }
}

function parsePlayer(raw: string, gender: Gender, currentYear: number): GuestPlayer | string {
  const match = raw.match(/^(.*?)\s*\((\d{4})\)\s*$/)
  const name = (match ? match[1]! : raw).replace(/\s+/g, ' ').trim()
  const birthYear = match ? Number(match[2]) : null
  if (!name) return 'nome vazio'
  if (name.length > GUEST_NAME_MAX) return `nome com mais de ${GUEST_NAME_MAX} caracteres`
  if (fold(name).split(' ').filter(Boolean).length < 2) return `"${name}": informe nome e sobrenome`
  if (birthYear !== null && (birthYear < MIN_BIRTH_YEAR || birthYear > currentYear)) return `"${name}": ano de nascimento ${birthYear} fora do intervalo`
  return { name, birthYear, gender }
}

/**
 * Lê a lista colada: um inscrito por linha; duplas como "Ana Souza / Bia Lima". Linhas vazias são ignoradas.
 * Exige nome e sobrenome (o pareamento entre categorias é pelo nome completo). Devolve as entradas ou os erros
 * por linha; uma pessoa repetida na mesma categoria é erro.
 */
export function parseGuestList(text: string, discipline: string, currentYear = new Date().getFullYear()): { entries: GuestEntry[]; errors: GuestListError[] } {
  const genders = gendersForDiscipline(discipline)
  const doubles = isDoublesDiscipline(discipline)
  const entries: GuestEntry[] = []
  const errors: GuestListError[] = []
  const seen = new Map<string, number>()

  const lines = text.split(/\r?\n/)
  if (lines.filter((l) => l.trim()).length > GUEST_LIST_MAX_LINES) {
    return { entries: [], errors: [{ line: 0, message: `A lista tem mais de ${GUEST_LIST_MAX_LINES} inscritos. Divida em partes.` }] }
  }

  lines.forEach((raw, index) => {
    const line = index + 1
    if (!raw.trim()) return
    const parts = raw.split('/').map((p) => p.trim())
    if (doubles && parts.length !== 2) return errors.push({ line, message: 'Dupla: escreva os dois nomes separados por "/".' })
    if (!doubles && parts.length !== 1) return errors.push({ line, message: 'Simples: um nome por linha, sem "/".' })

    const players: GuestPlayer[] = []
    for (const [i, part] of parts.entries()) {
      const player = parsePlayer(part, genders[i]!, currentYear)
      if (typeof player === 'string') return errors.push({ line, message: player.charAt(0).toUpperCase() + player.slice(1) + '.' })
      players.push(player)
    }
    if (doubles && guestKey(players[0]!.name) === guestKey(players[1]!.name)) {
      return errors.push({ line, message: 'A dupla repete o mesmo nome.' })
    }
    for (const p of players) {
      const key = guestKey(p.name)
      const first = seen.get(key)
      if (first !== undefined) return errors.push({ line, message: `${p.name} já está na linha ${first}.` })
    }
    players.forEach((p) => seen.set(guestKey(p.name), line))
    entries.push({ line, players })
  })
  return { entries, errors }
}

/** Chave do pareamento: nome completo sem acento, caixa nem pontuação. */
export function guestKey(name: string): string {
  return fold(name)
}

export interface GuestCandidate {
  id: string
  name: string
  gender: Gender
  birthYear: number | null
}

/**
 * Avulso existente que representa o jogador, ou `null` para criar outro. Mesmo nome e gênero reaproveita;
 * com os dois anos conhecidos e diferentes, são homônimos (outro avulso). Entre vários, prefere o de mesmo ano,
 * depois o primeiro da lista (o mais antigo).
 */
export function matchGuest(candidates: readonly GuestCandidate[], player: GuestPlayer): GuestCandidate | null {
  const key = guestKey(player.name)
  const same = candidates.filter((c) => guestKey(c.name) === key && c.gender === player.gender)
  const compatible = same.filter((c) => player.birthYear === null || c.birthYear === null || c.birthYear === player.birthYear)
  return compatible.find((c) => player.birthYear !== null && c.birthYear === player.birthYear) ?? compatible[0] ?? null
}
