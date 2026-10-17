// Server-side OpenPanel tracking: which events fire on which API action, that
// the per-tenant opt-out silences everything, and that the tracking never
// throws — not even when the OpenPanel request itself fails. Env has to be set
// before the modules read it, so they are imported below.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DATA = mkdtempSync(path.join(tmpdir(), 'lb-analytics-'))
const TENANT = 'trackschule'
const PIN = '4711'
const EMAIL = 'leitung@trackschule.example'
const PASSWORD = 'ein-langes-passwort'

process.env.RAUMBOARD_DATA = DATA
process.env.RAUMBOARD_DEFAULT_TENANT = TENANT
process.env.RAUMBOARD_DEMO_TENANT = ''
process.env.RAUMBOARD_NO_LISTEN = '1'
process.env.RAUMBOARD_SECRET = 'test-secret-test-secret-test-secret'
process.env.RAUMBOARD_EVENTS_URL = 'http://events.test/sink'
process.env.RAUMBOARD_EVENTS_FORMAT = 'openpanel'
process.env.RAUMBOARD_EVENTS_HEADERS = JSON.stringify({
  'openpanel-client-id': 'test-client-id',
  Origin: 'https://www.raumboard.de',
})

const { openTenant } = await import('./tenant')
const board = await import('./board')
const { hashSecret } = await import('./auth')
const { buildSeed } = await import('../src/seed')
const { OPT_OUT_KEY, resetAnalyticsForTest } = await import('./analytics')

const db = openTenant(TENANT, { create: true })
board.replaceAll(db, buildSeed())
board.createUser(db, EMAIL, hashSecret(PASSWORD), 'owner')
board.setConfig(db, 'pin_hash', hashSecret(PIN))
board.setConfig(db, 'pin_length', String(PIN.length))

// record every outgoing event request instead of sending it
const sent: { name: string; properties: Record<string, unknown>; profileId?: string; tenant?: string }[] = []
const realFetch = globalThis.fetch
globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
  // openpanel format: { type: 'track', payload: { name, profileId, properties } }
  const body = JSON.parse(String(init?.body))
  assert.equal(body.type, 'track')
  assert.equal(init?.headers && (init.headers as Record<string, string>)['openpanel-client-id'], 'test-client-id')
  sent.push(body.payload)
  return new Response('ok', { status: 200 })
}) as typeof fetch

const { app } = await import('./index')

test.after(() => {
  globalThis.fetch = realFetch
  rmSync(DATA, { recursive: true, force: true })
})

function call(
  method: string,
  path: string,
  { body, cookies = {} }: { body?: object; cookies?: Record<string, string> } = {},
) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return app.request(`/api${path}`, {
    method,
    headers: {
      host: `${TENANT}.raumboard.de`,
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? (method === 'POST' ? '{}' : undefined) : JSON.stringify(body),
  })
}

function cookieFrom(res: Response, name: string): string {
  const set = res.headers.get('set-cookie') ?? ''
  const match = set.match(new RegExp(`${name}=([^;]+)`))
  return match?.[1] ?? ''
}

const events = () => sent.map((e) => e.name)

/** Unlock the device (the login is a separate step — only one test needs it). */
async function unlockedBoard() {
  const pinRes = await call('POST', '/pin', { body: { pin: PIN } })
  return { cookies: { rb_board: cookieFrom(pinRes, 'rb_board') } }
}

async function unlockedAndSignedIn() {
  const { cookies } = await unlockedBoard()
  // /api/login sits behind the device guard, so the freshly unlocked board rides along
  const loginRes = await call('POST', '/login', {
    body: { email: EMAIL, password: PASSWORD },
    cookies,
  })
  return { cookies: { ...cookies, rb_admin: cookieFrom(loginRes, 'rb_admin') } }
}

test('app_open fires on an unlocked state fetch, deduped per board', async () => {
  resetAnalyticsForTest()
  sent.length = 0
  const { cookies } = await unlockedAndSignedIn()
  const first = await call('GET', '/state', { cookies })
  assert.equal(first.status, 200)
  assert.deepEqual(events(), ['admin_login', 'app_open'])
  const open = sent.find((e) => e.name === 'app_open')!
  assert.equal(open.properties.tenant, TENANT)
  assert.match(String(open.properties.board), /^[0-9a-f]{16}$/)
  // the second state fetch of the same session counts once
  await call('GET', '/state', { cookies })
  assert.equal(events().filter((n) => n === 'app_open').length, 1)
})

test('booking and return carry the room id, never a name', async () => {
  resetAnalyticsForTest()
  sent.length = 0
  const { cookies } = await unlockedBoard()
  const body: any = await (await call("GET", "/state", { cookies })).json()
  const state = body.state
  const kid = state.kids.find((k: any) => k.currentRoomId === null)
  const room = state.rooms.find((r: any) => r.isOpen && r.capacity > 0)
  await call('POST', '/book', { body: { kidId: kid.id, roomId: room.id }, cookies })
  await call('POST', '/unbook', { body: { kidId: kid.id }, cookies })
  assert.deepEqual(events(), ['app_open', 'booking', 'return'])
  assert.equal(sent[1].properties.room, room.id)
  assert.equal(sent[1].properties.tenant, TENANT)
  assert.equal(sent[2].properties.room, room.id)
  assert.ok(!JSON.stringify(sent).includes(kid.name))
})

test('failed PIN attempts are counted per gate', async () => {
  resetAnalyticsForTest()
  sent.length = 0
  const { cookies } = await unlockedBoard()
  await call('POST', '/pin', { body: { pin: '0000' } })
  const verify = await call('POST', '/teacher/verify', { body: { pin: '0000' }, cookies })
  assert.equal(verify.status, 401)
  assert.deepEqual(events(), ['pin_unlock_failed', 'pin_unlock_failed'])
  assert.deepEqual(
    sent.map((e) => e.properties.gate),
    ['board', 'verwaltung'],
  )
})

test('the tenant opt-out silences every event', async () => {
  resetAnalyticsForTest()
  board.setConfig(db, OPT_OUT_KEY, '1')
  sent.length = 0
  const { cookies } = await unlockedBoard()
  const body: any = await (await call("GET", "/state", { cookies })).json()
  const state = body.state
  const kid = state.kids.find((k: any) => k.currentRoomId === null)
  const room = state.rooms.find((r: any) => r.isOpen && r.capacity > 0)
  await call('POST', '/book', { body: { kidId: kid.id, roomId: room.id }, cookies })
  await call('POST', '/unbook', { body: { kidId: kid.id }, cookies })
  await call('POST', '/pin', { body: { pin: '0000' } })
  await call('POST', '/login', { body: { email: EMAIL, password: PASSWORD } })
  assert.deepEqual(events(), [])
  board.setConfig(db, OPT_OUT_KEY, '0')
})

test('a failing event endpoint never breaks the API', async () => {
  resetAnalyticsForTest()
  globalThis.fetch = (async () => {
    throw new Error('netz weg')
  }) as typeof fetch
  const { cookies } = await unlockedBoard()
  const res = await call('GET', '/state', { cookies })
  assert.equal(res.status, 200)
  globalThis.fetch = (async (_u: string | URL, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)).payload)
    return new Response('ok', { status: 200 })
  }) as typeof fetch
})
