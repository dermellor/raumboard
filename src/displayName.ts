import type { Kid } from './types'

/**
 * First-name part of a stored name ("Edgar E." → "Edgar"). The stored name
 * always carries the last-name initial so two same first names stay
 * distinguishable in the data; the boards decide per school whether it is
 * worth showing (see displayName).
 */
export const firstName = (name: string) => name.split(' ')[0]

const norm = (name: string) => firstName(name).trim().toLowerCase()

/**
 * Display name for the boards: the last-name initial is shown only when the
 * first name occurs more than once in the whole school (rooms mix classes,
 * so the scope is the school, not the class). A unique first name is shown
 * alone.
 */
export function displayName(name: string, kids: Kid[]): string {
  const first = firstName(name)
  const sameFirstName = kids.filter((k) => norm(k.name) === norm(name)).length
  return sameFirstName > 1 ? name : first
}
