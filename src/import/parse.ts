import * as XLSX from 'xlsx'
import { EMOJI_CATEGORIES } from '../emojis'

// Client-side import parsing. The full last name is only ever used here in the
// browser to derive an initial; it is never put into a PreparedKid and never
// sent to the server (see AGENTS.md privacy rule).

export type ParsedTable = {
  headers: string[] // first row (or synthetic "Spalte N" when no header)
  rows: string[][] // data rows (header excluded)
}

export type FieldKey = 'firstName' | 'lastName' | 'fullName' | 'klass' | 'symbol'

/** field → column index (into headers/rows); undefined = unmapped */
export type Mapping = Partial<Record<FieldKey, number>>

export type PreparedKid = {
  rowIndex: number
  name: string // display name, last name already shortened to initial
  symbol: string
  klassName: string | null // per-row class (from a class column) or null → use target
  issues: string[] // e.g. "kein Vorname"
}

/** kid-friendly emoji pool for auto-assignment (animals, nature, food) */
const EMOJI_POOL: string[] = ['Tiere', 'Natur & Pflanzen', 'Essen', 'Sport & Spiel']
  .flatMap((name) => EMOJI_CATEGORIES.find((c) => c.name === name)?.emojis ?? [])

/** Read xlsx/csv into a trimmed matrix (blank rows dropped). */
export async function parseFile(file: File): Promise<string[][]> {
  const buf = new Uint8Array(await file.arrayBuffer())
  // SheetJS auto-detects xlsx vs csv from the bytes
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  })
  return matrix.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some((c) => c !== ''))
}

/**
 * Guess which matrix row is the header. Picks the row with the most
 * field-keyword hits (title/blank rows above score 0); falls back to the
 * first row when nothing matches.
 */
export function detectHeaderRow(matrix: string[][]): number {
  let best = 0
  let bestScore = -1
  const limit = Math.min(matrix.length, 12)
  for (let i = 0; i < limit; i++) {
    if (i >= matrix.length - 1) break // need at least one data row below
    const score = matrix[i].reduce(
      (n, cell) => n + (PATTERNS.some((p) => p.re.test(cell.trim())) ? 1 : 0),
      0,
    )
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

/** Slice a matrix into header + data rows at the given header index. */
export function sliceTable(matrix: string[][], headerRow: number): ParsedTable {
  const headers = matrix[headerRow] ?? []
  return { headers, rows: matrix.slice(headerRow + 1) }
}

const PATTERNS: { field: FieldKey; re: RegExp }[] = [
  { field: 'firstName', re: /^(vor|ruf)name|first ?name/i },
  { field: 'lastName', re: /nach ?name|familien ?name|last ?name|surname/i },
  { field: 'klass', re: /^(klasse|class|kl\.?|jahrgang|gruppe)$/i },
  { field: 'symbol', re: /symbol|emoji|zeichen|tier|icon/i },
  { field: 'fullName', re: /^name( des kindes)?$|voller name|schüler|sch.ler|name$/i },
]

/** Heuristic column mapping from the header row. */
export function guessMapping(headers: string[]): Mapping {
  const map: Mapping = {}
  headers.forEach((h, i) => {
    for (const { field, re } of PATTERNS) {
      if (map[field] === undefined && re.test(h.trim())) {
        map[field] = i
        break
      }
    }
  })
  // A bare "Name" column next to a "Vorname" column is the surname, not a full
  // name (common in German exports: columns "Name" + "Vorname").
  if (
    map.firstName !== undefined &&
    map.lastName === undefined &&
    map.fullName !== undefined &&
    /^name$/i.test((headers[map.fullName] ?? '').trim())
  ) {
    map.lastName = map.fullName
    delete map.fullName
  }
  // If we found a separate first + last name, a lone "fullName" match is noise.
  if (map.firstName !== undefined && map.lastName !== undefined) delete map.fullName
  // If nothing matched at all, assume col 0 is a full name.
  if (map.firstName === undefined && map.fullName === undefined && headers.length > 0) map.fullName = 0
  return map
}

function initial(lastName: string): string {
  const t = lastName.trim()
  return t ? `${t.charAt(0).toUpperCase()}.` : ''
}

/**
 * Split a full name into (given names, last initial). A comma or semicolon
 * means "Nachname, Vorname" (surname first, as most German school exports write
 * it); otherwise the last whitespace token is the surname.
 */
function fromFullName(full: string): { first: string; init: string } {
  const trimmed = full.trim()
  const sep = trimmed.match(/\s*[,;]\s*/)
  if (sep) {
    const [surname, given] = trimmed.split(/\s*[,;]\s*/, 2)
    return { first: (given ?? '').trim(), init: initial(surname) }
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { first: parts[0], init: '' }
  const last = parts.pop() as string
  return { first: parts.join(' '), init: initial(last) }
}

/**
 * Turn parsed rows into ready-to-import kids: shortens surnames to an initial,
 * assigns emojis avoiding collisions with `usedSymbols`.
 */
export function prepareKids(
  table: ParsedTable,
  map: Mapping,
  usedSymbols: Set<string>,
): PreparedKid[] {
  const used = new Set(usedSymbols)
  const cell = (row: string[], field: FieldKey) => {
    const i = map[field]
    return i === undefined ? '' : (row[i] ?? '').trim()
  }
  const nextEmoji = () => EMOJI_POOL.find((e) => !used.has(e)) ?? '⭐'

  return table.rows.map((row, rowIndex) => {
    const issues: string[] = []
    let name = ''
    if (map.firstName !== undefined) {
      const first = cell(row, 'firstName')
      const init = initial(cell(row, 'lastName'))
      name = [first, init].filter(Boolean).join(' ')
    } else if (map.fullName !== undefined) {
      const { first, init } = fromFullName(cell(row, 'fullName'))
      name = [first, init].filter(Boolean).join(' ')
    }
    if (!name) issues.push('kein Name')

    let symbol = cell(row, 'symbol')
    if (!symbol) {
      symbol = nextEmoji()
      used.add(symbol)
    }

    const klassName = map.klass !== undefined ? cell(row, 'klass') || null : null

    return { rowIndex, name, symbol, klassName, issues }
  })
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  firstName: 'Vorname',
  lastName: 'Nachname',
  fullName: 'Voller Name',
  klass: 'Klasse',
  symbol: 'Symbol',
}
