import type { BoardState, BookResult, Kid, Room, TimeWindow } from './types'

// Pure booking rules — shared between the frontend stores and the server
// (server/board.ts). Keep this module free of browser/node APIs.

export function occupancy(roomId: string, s: BoardState): number {
  return s.kids.filter((k) => k.currentRoomId === roomId).length
}

export function freeSlots(room: Room, s: BoardState): number {
  return room.capacity - occupancy(room.id, s)
}

/** Where on the weekly grid "now" sits: ISO weekday (1 = Mo … 7 = So) and
 *  minutes since local midnight. Passing this in keeps this module pure and
 *  lets tests pin the clock. */
export type NowPoint = { day: number; minutes: number }

const HM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** '14:30' → 870; invalid → NaN. */
export function parseHM(hm: string): number {
  const m = HM_RE.exec(hm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/** Normalizes client input into valid windows: plausible days, valid times,\n *  start before end. Nothing valid survives → undefined = always available,\n *  so a malformed payload can never make a room silently unbookable. */
export function normalizeWindows(value: unknown): TimeWindow[] | undefined {
  if (!Array.isArray(value)) return undefined
  const windows: TimeWindow[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue
    const { days, start, end } = raw as Record<string, unknown>
    if (!Array.isArray(days) || typeof start !== 'string' || typeof end !== 'string') continue
    const validDays = [...new Set(days)].filter(
      (d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7,
    )
    const from = parseHM(start)
    const to = parseHM(end)
    if (!validDays.length || Number.isNaN(from) || Number.isNaN(to) || from >= to) continue
    windows.push({ days: validDays.sort((a, b) => a - b), start, end })
  }
  return windows.length ? windows : undefined
}

/** True if a window covers the given day and minute. */
function covers(w: TimeWindow, now: NowPoint): boolean {
  if (!w.days.includes(now.day)) return false
  const from = parseHM(w.start)
  const to = parseHM(w.end)
  return now.minutes >= from && now.minutes < to
}

/** True if any window lists the given weekday — the room is part of today's
 *  program at all, even outside its hours. Rooms without windows always are. */
export function offeredToday(room: Room, day: number): boolean {
  if (!room.windows?.length) return true
  return room.windows.some((w) => w.days.includes(day))
}

/** A room without windows is always available; otherwise one window must cover now. */
export function isAvailableNow(room: Room, now: NowPoint): boolean {
  if (!room.windows?.length) return true
  return room.windows.some((w) => covers(w, now))
}

/** canBook's time-gate message, or null when the room is available right now. */
function availabilityMessage(room: Room, now: NowPoint): string | null {
  if (!room.windows?.length) return null
  if (isAvailableNow(room, now)) return null
  const today = room.windows.filter((w) => w.days.includes(now.day))
  if (today.length === 0) return 'Heute nicht im Angebot'
  const sorted = today
    .map((w) => ({ w, from: parseHM(w.start), to: parseHM(w.end) }))
    .sort((a, b) => a.from - b.from)
  const upcoming = sorted.find(({ from }) => now.minutes < from)
  if (upcoming) return `Erst um ${upcoming.w.start}`
  return 'Heute nicht mehr'
}

export function canBook(kid: Kid, room: Room, s: BoardState, now?: NowPoint): BookResult {
  if (!room.isOpen) return { ok: false, reason: 'Raum ist geschlossen' }
  if (room.scope !== 'all' && !room.scope.includes(kid.klassId))
    return { ok: false, reason: 'Raum gehört einer anderen Klasse' }
  if (now) {
    const message = availabilityMessage(room, now)
    if (message) return { ok: false, reason: message }
  }
  if (kid.currentRoomId !== room.id && freeSlots(room, s) <= 0)
    return { ok: false, reason: 'Raum ist voll' }
  return { ok: true }
}
