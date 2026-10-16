/**
 * Server-side OpenPanel tracking. There is deliberately no browser SDK: events
 * arise in the Node backend via OpenPanel's HTTP API, so no script, cookie or
 * IP ever reaches a board, and a school's opt-out cannot be bypassed client-side.
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

/** Self-hosted OpenPanel instance; the project key comes from the instance profile. */
const OP_URL = (process.env.RAUMBOARD_OPENPANEL_URL ?? 'https://analytics.12signals.com').replace(/\/$/, '')
const OP_KEY = process.env.RAUMBOARD_OPENPANEL_KEY?.trim() ?? ''

/** Config key (per-tenant `config` table) that switches tracking off for a school. */
export const OPT_OUT_KEY = 'analytics_opt_out'

/** Tracking is off entirely without a project key. */
export const analyticsEnabled = OP_KEY !== ''

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
  const body = JSON.stringify({
    name,
    // the tenant slug doubles as OpenPanel's profileId, which is what lets the
    // dashboard group events per school without any personal identifier
    profileId: boardId,
    properties: { tenant: boardId, ...properties },
  })
  fetch(`${OP_URL}/api/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'open-panel-api-key': OP_KEY },
    body,
  })
    .then((res) => {
      if (!res.ok) console.warn(`openpanel: ${name} abgelehnt (HTTP ${res.status})`)
    })
    .catch((err) => {
      console.warn(`openpanel: ${name} nicht gesendet (${(err as Error).message})`)
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
