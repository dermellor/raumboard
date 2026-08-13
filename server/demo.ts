// The public demo: one throwaway board per visitor, held in RAM only.
//
// A demo whose credentials are printed on a website has two problems a school's
// board does not have. Whatever a visitor types must not be kept, and two
// visitors must not overwrite each other. So the demo slug gets no
// `data/<slug>.db` at all: every browser session opens its own in-memory
// SQLite, seeded from the same dummy data, and it is gone when the session goes
// idle or the service restarts. Nothing to back up, nothing to erase, no AVV
// question — there is no personal data on disk to have one about.
//
// The trade-off of per-visitor boards: two devices are two sessions, so the
// "book on the whiteboard, watch it appear on the iPad" demo only works inside
// one browser (its tabs share the cookie, and the WebSocket broadcast reaches
// them all).

import Database from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { buildSeed } from '../src/seed'
import { hashSecret } from './auth'
import * as board from './board'
import { migrate } from './migrations'
import { DEFAULT_TENANT, DEMO_TENANT, dbPath } from './tenant'

/** Published with the demo link, so weak on purpose. */
const LOGIN = process.env.RAUMBOARD_DEMO_LOGIN ?? 'demo@raumboard.de'
const PASSWORD = process.env.RAUMBOARD_DEMO_PASSWORD ?? 'raumboard-demo'
const PIN = process.env.RAUMBOARD_DEMO_PIN ?? '1234'
export const DEMO_SCHOOL_NAME = process.env.RAUMBOARD_DEMO_NAME ?? 'Demoschule'

/** A board costs memory until its session is idle, so idle ones are dropped. */
const IDLE_MS = Number(process.env.RAUMBOARD_DEMO_IDLE_MINUTES ?? 60) * 60_000
/** Backstop against a crawler minting sessions: the oldest gives way. */
const MAX_BOARDS = Number(process.env.RAUMBOARD_DEMO_MAX_BOARDS ?? 200)
const SWEEP_MS = 5 * 60_000

const SESSION_RE = /^[0-9a-f]{32}$/

// Two configurations that would look like they work and would not. Refused at
// import, which means at server start, rather than per request.
if (DEMO_TENANT && existsSync(dbPath(DEMO_TENANT)))
  throw new Error(
    `RAUMBOARD_DEMO_TENANT=${DEMO_TENANT}, aber ${dbPath(DEMO_TENANT)} existiert. ` +
      'Die Demo würde diese Datenbank verdecken und ihre Daten unerreichbar machen. ' +
      'Datei wegräumen, oder einen Slug wählen, der keine echte Schule ist.',
  )
if (DEMO_TENANT && DEFAULT_TENANT && DEFAULT_TENANT !== DEMO_TENANT)
  throw new Error(
    `RAUMBOARD_DEMO_TENANT=${DEMO_TENANT} bliebe unerreichbar: RAUMBOARD_DEFAULT_TENANT=${DEFAULT_TENANT} ` +
      'bindet jeden Host an diesen einen Mandanten. Entweder beide auf denselben Slug setzen ' +
      '(dann ist die ganze Instanz eine Demo), oder RAUMBOARD_DEFAULT_TENANT leeren (Plattform-Modus).',
  )

// --- session ids -------------------------------------------------------------

export function newSession(): string {
  return randomBytes(16).toString('hex')
}

export function isSession(value: string | undefined): value is string {
  return !!value && SESSION_RE.test(value)
}

/** `<slug>#<session>`: `#` cannot occur in a slug, so board ids stay disjoint. */
export function demoBoardId(session: string): string {
  return `${DEMO_TENANT}#${session}`
}

export function isDemoBoard(id: string): boolean {
  return !!DEMO_TENANT && id.startsWith(`${DEMO_TENANT}#`)
}

/**
 * Handed to the browser so the demo can prefill its own login and PIN: a visitor
 * is here to see the product, not to copy credentials out of a website. Sent for
 * demo boards only — for a school this is where its password would be.
 */
export function demoCredentials() {
  return { email: LOGIN.toLowerCase(), password: PASSWORD, pin: PIN }
}

// --- boards ------------------------------------------------------------------

type Held = { db: Database.Database; seen: number }
const boards = new Map<string, Held>()

/** scrypt is deliberately slow, and the demo hash is the same for everyone. */
let hashes: { admin: string; pin: string } | null = null
function credentialHashes() {
  if (!hashes) hashes = { admin: hashSecret(PASSWORD), pin: hashSecret(PIN) }
  return hashes
}

/** Seed data plus the published credentials — also the reset target. */
function seed(db: Database.Database): void {
  migrate(db, DEMO_TENANT ?? 'demo')
  board.replaceAll(db, buildSeed())
  board.setConfig(db, 'school_name', DEMO_SCHOOL_NAME)
  board.setConfig(db, 'admin_email', LOGIN.toLowerCase())
  board.setConfig(db, 'admin_hash', credentialHashes().admin)
  board.setConfig(db, 'pin_hash', credentialHashes().pin)
  board.setConfig(db, 'pin_length', String(PIN.length))
}

export function openDemoBoard(id: string): Database.Database {
  const held = boards.get(id)
  if (held) {
    held.seen = Date.now()
    return held.db
  }
  if (boards.size >= MAX_BOARDS) dropOldest()
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  seed(db)
  boards.set(id, { db, seen: Date.now() })
  return db
}

/** Back to the seed, including credentials an admin may have changed in the demo. */
export function resetDemoBoard(id: string): void {
  const held = boards.get(id)
  if (!held) {
    openDemoBoard(id)
    return
  }
  held.seen = Date.now()
  seed(held.db)
}

function drop(id: string): void {
  const held = boards.get(id)
  if (!held) return
  boards.delete(id)
  held.db.close()
}

function dropOldest(): void {
  let oldest: string | null = null
  let seen = Infinity
  for (const [id, held] of boards)
    if (held.seen < seen) {
      seen = held.seen
      oldest = id
    }
  if (oldest) drop(oldest)
}

/** Returns how many idle boards were dropped (the sweeper's unit of work). */
export function sweepDemoBoards(now = Date.now()): number {
  let dropped = 0
  for (const [id, held] of boards)
    if (now - held.seen > IDLE_MS) {
      drop(id)
      dropped++
    }
  return dropped
}

export function demoBoardCount(): number {
  return boards.size
}

export function startDemoSweeper(): void {
  if (!DEMO_TENANT) return
  // unref'd: the interval must not be what keeps the process alive.
  setInterval(() => sweepDemoBoards(), SWEEP_MS).unref()
}
