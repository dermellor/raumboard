/**
 * Server-side usage events. There is deliberately no browser SDK: events
 * arise in the Node backend and are POSTed to whatever HTTP endpoint the
 * instance profile names — the core knows the events, not the tool that
 * evaluates them. No script, cookie or IP ever reaches a board, and a
 * school's opt-out cannot be bypassed client-side.
 *
 * Data minimization is the contract here (AGENTS.md): events carry only the
 * tenant slug, a board pseudonym (hash of the device token — no name, no IP),
 * room ids and counters. Never a person's name, not even first name + initial.
 *
 * Every send is fire-and-forget: booking and board operation must never wait
 * on (or fail because of) analytics. Errors are logged, never thrown.
 */
import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getConfig } from './board'

/**
 * Where events are POSTed to (a complete URL). Unset means tracking is
 * completely off — the default, which is what a self-hoster gets.
 */
const EVENTS_URL = process.env.RAUMBOARD_EVENTS_URL?.trim() ?? ''
/**
 * Body format: `plain` (default) sends `{ name, tenant, properties }`;
 * `openpanel` wraps that in OpenPanel's `{ type: 'track', payload: … }`
 * ingestion envelope and maps the tenant to its `profileId`.
 */
const EVENTS_FORMAT = process.env.RAUMBOARD_EVENTS_FORMAT?.trim() || 'plain'
/**
 * Extra request headers as a JSON object, e.g. for an ingestion endpoint
 * that authenticates per header (OpenPanel checks `Origin` and
 * `openpanel-client-id`). Invalid JSON disables tracking with a warning
 * rather than sending headers half-configured.
 */
const EVENTS_HEADERS = (() => {
  const raw = process.env.RAUMBOARD_EVENTS_HEADERS?.trim()
  if (!raw) return {} as Record<string, string>
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : null
  } catch {
    return null
  }
})()

/** Config key (per-tenant `config` table) that switches tracking off for a school. */
export const OPT_OUT_KEY = 'analytics_opt_out'

if (EVENTS_HEADERS === null) {
  console.warn('analytics: RAUMBOARD_EVENTS_HEADERS ist kein JSON-Objekt — Tracking bleibt aus.')
}

/** Tracking is off entirely without a configured endpoint (or valid headers). */
export const analyticsEnabled =
  EVENTS_URL !== '' && EVENTS_FORMAT !== '' && EVENTS_HEADERS !== null

type EventProps = Record<string, string | number | boolean>

/** Demo boards are throwaway per-visitor copies, not a school — never tracked. */
function isDemoBoard(boardId: string): boolean {
  return boardId.includes('#')
}

/**
 * The one externally visible event. Safe to call from any request path: it
 * reads the tenant's opt-out, posts asynchronously and swallows every error.
 */
export function track(boardId: string, db: Database.Database, name: string, properties: EventProps): void {
  if (!analyticsEnabled) return
  if (isDemoBoard(boardId)) return
  if (getConfig(db, OPT_OUT_KEY) === '1') return
  const props = { tenant: boardId, ...properties }
  const body =
    EVENTS_FORMAT === 'openpanel'
      ? // the tenant slug doubles as the profileId, which is what lets a
        // dashboard group events per school without any personal identifier
        JSON.stringify({
          type: 'track',
          payload: { name, profileId: boardId, properties: props },
        })
      : JSON.stringify({ name, tenant: boardId, properties: props })
  fetch(EVENTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...EVENTS_HEADERS },
    body,
  })
    .then((res) => {
      if (!res.ok) console.warn(`analytics: ${name} abgelehnt (HTTP ${res.status})`)
    })
    .catch((err) => {
      console.warn(`analytics: ${name} nicht gesendet (${(err as Error).message})`)
    })
}

/**
 * Pseudonym for one physical board/device: a truncated hash of its device
 * token. The token is random and signed, so the hash carries nothing about the
 * school's data — it exists only so "one whiteboard opened the app three times"
 * stays distinguishable from "three whiteboards".
 */
export function boardPseudonym(token: string | undefined): string | undefined {
  if (!token) return undefined
  return createHash('sha256').update(token).digest('hex').slice(0, 16)
}

/**
 * `app_open` with a per-board dedupe: the frontend fetches `/api/state` on
 * every page load and reconnects its WebSocket after sleeps, so one session
 * would otherwise count many times. One open per board per 30 minutes.
 */
const APP_OPEN_WINDOW_MS = 30 * 60_000
const appOpenSeen = new Map<string, number>()

export function trackAppOpen(boardId: string, db: Database.Database, pseudonym: string): void {
  const key = `${boardId}:${pseudonym}`
  const now = Date.now()
  const last = appOpenSeen.get(key) ?? 0
  if (now - last < APP_OPEN_WINDOW_MS) return
  appOpenSeen.set(key, now)
  track(boardId, db, 'app_open', { board: pseudonym })
}

/** Test hook: forget the dedupe so each test case starts clean. */
export function resetAnalyticsForTest(): void {
  appOpenSeen.clear()
}
