import type { Kid } from './types'

/**
 * The first word of a stored name — the greeting's "Hauptvorname"
 * ("Ella Elise C." → "Ella"). The stored name always carries the last-name
 * initial so same first names stay distinguishable in the data; the boards
 * decide per school whether it is worth showing (see displayName).
 */
export const firstName = (name: string) => name.split(' ')[0]

/**
 * The given name: everything except the trailing last-name initial
 * ("Ella Elise C." → "Ella Elise", "Ella" → "Ella", "Ella-Elisa C." →
 * "Ella-Elisa"). A hyphenated name is one token, so one first name.
 */
export function givenName(name: string): string {
  const tokens = name.split(' ')
  const last = tokens[tokens.length - 1]
  // a lone letter, with or without the dot, is the last-name initial
  if (tokens.length > 1 && /^[^\s]\.?$/.test(last)) tokens.pop()
  return tokens.join(' ')
}

/** Fold accents (NFD, strip combining marks) so "Penélope" and "Penelope"
 * compare as one first name; the display keeps the stored spelling. */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Comparison form of a given name: case-insensitive, accent-folded, with
 * hyphen and space spellings of the same name folded together. */
const norm = (name: string) => fold(givenName(name).toLowerCase()).replace(/[-\s]+/g, ' ').trim()

/**
 * Display name for the boards: the last-name initial is shown only when the
 * given name occurs more than once in the whole school (rooms mix classes,
 * so the scope is the school, not the class). A unique given name is shown
 * alone, without the initial.
 */
export function displayName(name: string, kids: Kid[]): string {
  const same = kids.filter((k) => norm(k.name) === norm(name)).length
  return same > 1 ? name : givenName(name)
}
