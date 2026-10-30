// Time windows (AG-Lernorte): a room with `windows` is bookable only on those
// weekdays between those times — in Europe/Berlin on both server and boards.
// Tested here: the pure rules (availability, reasons, normalization), the
// storage roundtrip through SQLite (migration column included, via addRoom /
// updateRoom / loadState / replaceAll), and that the booking route enforces
// the window server-side.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DATA = mkdtempSync(path.join(tmpdir(), 'lb-windows-'))
const TENANT = 'testschule'
const PIN = '4711'

process.env.RAUMBOARD_DATA = DATA
process.env.RAUMBOARD_DEFAULT_TENANT = TENANT
process.env.RAUMBOARD_DEMO_TENANT = ''
process.env.RAUMBOARD_NO_LISTEN = '1'
process.env.RAUMBOARD_SECRET = 'test-secret-test-secret-test-secret'

const { openTenant } = await import('./tenant')
const board = await import('./board')
const { hashSecret } = await import('./auth')
const { buildSeed } = await import('../src/seed')

const db = openTenant(TENANT, { create: true })
board.replaceAll(db, buildSeed())
board.setConfig(db, 'pin_hash', hashSecret(PIN))
board.setConfig(db, 'pin_length', String(PIN.length))

const logic = await import('../src/boardLogic')
const { nowPoint } = await import('../src/nowPoint')

// cleanup at process exit: node:test's `after` hook fired between async
// subtests here and deleted the database while later tests still ran
process.on('exit', () => {
  try {
    rmSync(DATA, { recursive: true, force: true })
  } catch {
    /* tmp dir; the OS cleans up anyway */
  }
})

const DO_1430_1600 = { days: [4], start: '14:30', end: '16:00' } // Donnerstag, 2. Zeitfenster
const MO = { day: 1, minutes: 15 * 60 } // Montag 15:00
const DO_MIDDAY = { day: 4, minutes: 13 * 60 } // Donnerstag 13:00
const DO_LATE = { day: 4, minutes: 15 * 60 + 30 } // Donnerstag 15:30
const FR = { day: 5, minutes: 14 * 60 }

// --- pure rules ---------------------------------------------------------------

test('ohne Zeitfenster ist ein Raum immer verfügbar', () => {
  const room = { id: 'r', name: 'R', emoji: '🚪', capacity: 4, isOpen: true, scope: 'all' as const }
  assert.equal(logic.isAvailableNow(room, MO), true)
  assert.equal(logic.isAvailableNow(room, FR), true)
})

test('ein Zeitfenster begrenzt Wochentag und Uhrzeit', () => {
  const room = {
    id: 'r',
    name: 'R',
    emoji: '🚪',
    capacity: 4,
    isOpen: true,
    scope: 'all' as const,
    windows: [DO_1430_1600],
  }
  assert.equal(logic.isAvailableNow(room, DO_LATE), true)
  assert.equal(logic.isAvailableNow(room, DO_MIDDAY), false)
  assert.equal(logic.isAvailableNow(room, MO), false)
})

test('canBook begründet die Zeit dynamisch', () => {
  const room = {
    id: 'r',
    name: 'R',
    emoji: '🚪',
    capacity: 4,
    isOpen: true,
    scope: 'all' as const,
    windows: [DO_1430_1600],
  }
  const kid = { id: 'k', klassId: '1a', symbol: '⭐', name: 'Kind', currentRoomId: null }
  const s = { klasses: [], kids: [kid], rooms: [room] }
  assert.deepEqual(logic.canBook(kid, room, s, { day: 2, minutes: 13 * 60 }), {
    ok: false,
    reason: 'Heute nicht im Angebot',
  })
  assert.deepEqual(logic.canBook(kid, room, s, DO_MIDDAY), { ok: false, reason: 'Erst um 14:30' })
  assert.deepEqual(logic.canBook(kid, room, s, { day: 4, minutes: 16 * 60 }), {
    ok: false,
    reason: 'Heute nicht mehr',
  })
  assert.deepEqual(logic.canBook(kid, room, s, DO_LATE), { ok: true })
})

test('normalizeWindows verwirft kaputte Fenster, nie den Raum', () => {
  assert.equal(logic.normalizeWindows(undefined), undefined)
  assert.equal(logic.normalizeWindows([]), undefined)
  assert.equal(logic.normalizeWindows('nonsense'), undefined)
  // invalid pieces vanish, valid ones survive
  assert.deepEqual(
    logic.normalizeWindows([{ days: [9, 1], start: '13:00', end: '14:30' }, { days: [2], start: '15:00', end: '14:00' }]),
    [{ days: [1], start: '13:00', end: '14:30' }],
  )
})

test('nowPoint liegt auf Berliner Zeit', () => {
  // 2026-11-05 13:05 UTC = 14:05 in Berlin, ein Donnerstag
  const p = nowPoint(new Date('2026-11-05T13:05:00Z'))
  assert.equal(p.day, 4)
  assert.equal(p.minutes, 14 * 60 + 5)
})

// --- storage roundtrip --------------------------------------------------------

test('Zeitfenster wandern durch addRoom/updateRoom/loadState', () => {
  board.addRoom(db, 'Offene Werkstatt', '🔨', 12, 'all', [{ days: [1, 4], start: '14:30', end: '16:00' }])
  let room = board.loadState(db).rooms.find((r) => r.name === 'Offene Werkstatt')
  assert.deepEqual(room?.windows, [{ days: [1, 4], start: '14:30', end: '16:00' }])

  board.updateRoom(db, room!.id, { windows: [DO_1430_1600] })
  room = board.loadState(db).rooms.find((r) => r.id === room!.id)
  assert.deepEqual(room?.windows, [DO_1430_1600])

  // [] räumt die Fenster weg: wieder immer verfügbar
  board.updateRoom(db, room!.id, { windows: [] })
  room = board.loadState(db).rooms.find((r) => r.id === room!.id)
  assert.equal(room?.windows, undefined)
})

test('unbrauchbare Client-Fenster werden beim Schreiben normalisiert', () => {
  board.addRoom(db, 'Kaputt', '💥', 4, 'all', [{ days: [], start: '99:99', end: 'nope' }] as never)
  const room = board.loadState(db).rooms.find((r) => r.name === 'Kaputt')
  assert.equal(room?.windows, undefined)
})

// --- booking route ------------------------------------------------------------

const { app } = await import('./index')

function fetchApi(method: string, url: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return app.request(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
}

const pinRes = await fetchApi('POST', '/api/pin', { pin: PIN })
const deviceCookie = (pinRes.headers.get('set-cookie') ?? '').split(';')[0]

const hm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

test('die Buchungsroute wertet das Zeitfenster gegen die echte Uhrzeit', async () => {
  const kid = board.loadState(db).kids[0]
  const now = nowPoint()

  // Fenster deckt die aktuelle Minute ab → buchen geht
  const openId = 'jetzt-offen'
  board.addRoom(db, 'Jetzt offen', '🔓', 8, 'all', [
    { days: [now.day], start: hm(Math.max(0, now.minutes - 1)), end: hm(Math.min(23 * 60 + 59, now.minutes + 1)) },
  ])
  const okRes = await fetchApi('POST', '/api/book', { kidId: kid.id, roomId: openId }, deviceCookie)
  const okBody = (await okRes.json()) as { ok?: boolean; reason?: string; error?: string }
  assert.equal(okBody.ok, true)
  board.unbook(db, kid.id)

  // gleiches Fenster einen Tag später verschoben → Zeit-Grund, kein Crash
  const otherDay = now.day === 1 ? 2 : 1
  const closedId = 'anderer-tag'
  board.addRoom(db, 'Anderer Tag', '🔒', 8, 'all', [
    { days: [otherDay], start: hm(Math.max(0, now.minutes - 1)), end: hm(Math.min(23 * 60 + 59, now.minutes + 1)) },
  ])
  const closedRes = await fetchApi('POST', '/api/book', { kidId: kid.id, roomId: closedId }, deviceCookie)
  assert.deepEqual(await closedRes.json(), { ok: false, reason: 'Heute nicht im Angebot' })
})
