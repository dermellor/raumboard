import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const DATA_DIR = process.env.RAUMBOARD_DATA ?? path.join(HERE, '..', 'data')
export const BASE_DOMAIN = process.env.RAUMBOARD_DOMAIN ?? 'raumboard.de'
/** Self-hosting / local dev: treat every host as this tenant. */
export const DEFAULT_TENANT = process.env.RAUMBOARD_DEFAULT_TENANT

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/

export function dbPath(slug: string): string {
  return path.join(DATA_DIR, `${slug}.db`)
}

/** Host header → tenant slug, or null (apex/landing or foreign host). */
export function slugFromHost(hostHeader: string | undefined): string | null {
  if (DEFAULT_TENANT) return DEFAULT_TENANT
  const host = (hostHeader ?? '').split(':')[0].toLowerCase()
  if (!host || host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) return null
  if (!host.endsWith(`.${BASE_DOMAIN}`)) return null
  const sub = host.slice(0, -(BASE_DOMAIN.length + 1))
  return SLUG_RE.test(sub) ? sub : null
}

export function tenantExists(slug: string): boolean {
  return SLUG_RE.test(slug) && existsSync(dbPath(slug))
}

const handles = new Map<string, Database.Database>()

export function openTenant(slug: string, { create = false } = {}): Database.Database {
  const cached = handles.get(slug)
  if (cached) return cached
  if (!SLUG_RE.test(slug)) throw new Error(`invalid tenant slug: ${slug}`)
  if (!create && !tenantExists(slug)) throw new Error(`unknown tenant: ${slug}`)
  mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(dbPath(slug))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  handles.set(slug, db)
  return db
}

function migrate(db: Database.Database): void {
  const version = db.pragma('user_version', { simple: true }) as number
  if (version < 1) {
    db.exec(readFileSync(path.join(HERE, 'schema.sql'), 'utf8'))
    db.pragma('user_version = 1')
  }
}
