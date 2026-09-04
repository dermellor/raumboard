// The access levels are the thing worth testing here: the teacher PIN opens the
// Verwaltung (rooms/classes/kids), a signed-in account opens the import and the
// account's own credentials, and an owner account opens the roster. Env has to
// be set before the modules read it, so they are imported below.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DATA = mkdtempSync(path.join(tmpdir(), 'lb-access-'))
const TENANT = 'testschule'
const PIN = '4711'
const EMAIL = 'leitung@testschule.example'
const PASSWORD = 'ein-langes-passwort'

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
board.createUser(db, EMAIL, hashSecret(PASSWORD), 'owner')
board.setConfig(db, 'pin_hash', hashSecret(PIN))
board.setConfig(db, 'pin_length', String(PIN.length))

const { app } = await import('./index')

test.after(() => rmSync(DATA, { recursive: true, force: true }))

/** One request against the app, with whatever cookies the caller collected. */
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

/** The value a response set for `name`, or '' when it cleared it. */
function cookieFrom(res: Response, name: string): string {
  const header = res.headers.getSetCookie().find((h) => h.startsWith(`${name}=`))
  assert.ok(header, `no Set-Cookie for ${name}`)
  return header.slice(name.length + 1).split(';')[0]
}

async function pinCookie(): Promise<string> {
  const res = await call('POST', '/pin', { body: { pin: PIN } })
  assert.equal(res.status, 200)
  return cookieFrom(res, 'rb_board')
}

async function adminCookie(): Promise<string> {
  const res = await call('POST', '/login', { body: { email: EMAIL, password: PASSWORD } })
  assert.equal(res.status, 200)
  return cookieFrom(res, 'rb_admin')
}

const someRoom = () => board.loadState(db).rooms[0]

/** `/api/state`'s auth flags, which is all these tests read from it. */
async function metaOf(res: Response): Promise<{ canOperate: boolean; isAdmin: boolean }> {
  const body = (await res.json()) as { meta: { canOperate: boolean; isAdmin: boolean } }
  return body.meta
}

test('without any cookie nothing can be changed', async () => {
  const meta = await metaOf(await call('GET', '/state'))
  assert.equal(meta.canOperate, false)
  assert.equal(meta.isAdmin, false)

  for (const [method, p] of [
    ['POST', '/rooms'],
    ['PATCH', `/rooms/${someRoom().id}`],
    ['DELETE', `/rooms/${someRoom().id}`],
    ['POST', '/kids'],
    ['POST', '/klasses'],
    ['POST', '/verify-password'],
    ['POST', '/change-pin'],
    ['POST', '/change-password'],
    ['POST', '/book'],
    ['POST', '/reset'],
  ] as const) {
    const res = await call(method, p, { body: { name: 'X' } })
    assert.equal(res.status, 401, `${method} ${p} should be locked`)
  }
})

test('the teacher PIN opens the whole Verwaltung', async () => {
  const rb_board = await pinCookie()
  const cookies = { rb_board }

  const meta = await metaOf(await call('GET', '/state', { cookies }))
  assert.equal(meta.canOperate, true)
  assert.equal(meta.isAdmin, false)

  const created = await call('POST', '/rooms', {
    cookies,
    body: { name: 'Leseecke', emoji: '📚', capacity: 3, scope: 'all' },
  })
  assert.equal(created.status, 200)
  const room = board.loadState(db).rooms.find((r) => r.name === 'Leseecke')!
  assert.ok(room)

  const closed = await call('PATCH', `/rooms/${room.id}`, { cookies, body: { isOpen: false } })
  assert.equal(closed.status, 200)
  assert.equal(board.loadState(db).rooms.find((r) => r.id === room.id)!.isOpen, false)

  const klass = await call('POST', '/klasses', { cookies, body: { name: '9Z' } })
  assert.equal(klass.status, 200)
  const klassId = board.loadState(db).klasses.find((k) => k.name === '9Z')!.id

  const kid = await call('POST', '/kids', { cookies, body: { klassId, symbol: '⭐', name: 'Test T.' } })
  assert.equal(kid.status, 200)

  assert.equal((await call('DELETE', `/rooms/${room.id}`, { cookies })).status, 200)
  assert.equal((await call('DELETE', `/klasses/${klassId}`, { cookies })).status, 200)
})

test('the import is the one thing the PIN does not open', async () => {
  const rb_board = await pinCookie()
  const kids = [{ name: 'Import I.', symbol: '🐝', klass: '1A' }]

  const refused = await call('POST', '/admin/import', { cookies: { rb_board }, body: { kids } })
  assert.equal(refused.status, 401)

  const rb_admin = await adminCookie()
  const accepted = await call('POST', '/admin/import', {
    cookies: { rb_board, rb_admin },
    body: { kids, mode: 'append', targetKlass: null },
  })
  assert.equal(accepted.status, 200)
  assert.ok(board.loadState(db).kids.some((k) => k.name === 'Import I.'))
})

test('verifying the password needs a signed-in account and changes nothing', async () => {
  // the PIN alone does not reach it any more: it is tied to a specific account
  const pinOnly = await call('POST', '/verify-password', {
    cookies: { rb_board: await pinCookie() },
    body: { password: PASSWORD },
  })
  assert.equal(pinOnly.status, 401)

  const cookies = { rb_admin: await adminCookie() }
  const wrong = await call('POST', '/verify-password', { cookies, body: { password: 'falsch' } })
  assert.equal(wrong.status, 401)

  const ok = await call('POST', '/verify-password', { cookies, body: { password: PASSWORD } })
  assert.equal(ok.status, 200)
  // it is a question, not a change: no cookie set
  assert.equal(ok.headers.getSetCookie().length, 0)
})

test('the credential forms verify against the signed-in account', async () => {
  const cookies = { rb_admin: await adminCookie() }

  const wrong = await call('POST', '/change-pin', { cookies, body: { password: 'falsch', pin: '9999' } })
  assert.equal(wrong.status, 401)

  const ok = await call('POST', '/change-pin', { cookies, body: { password: PASSWORD, pin: '9999' } })
  assert.equal(ok.status, 200)
  assert.equal(board.getConfig(db, 'pin_length'), '4')
  // put it back, the helpers above use the original PIN
  board.setConfig(db, 'pin_hash', hashSecret(PIN))
})

test('signing out of the account leaves the device unlocked', async () => {
  const rb_board = await pinCookie()
  const rb_admin = await adminCookie()

  const out = await call('POST', '/logout', { cookies: { rb_board, rb_admin } })
  assert.equal(cookieFrom(out, 'rb_admin'), '')
  assert.equal(
    out.headers.getSetCookie().some((h) => h.startsWith('rb_board=')),
    false,
    'logout must not touch the board cookie',
  )

  const locked = await call('POST', '/lock', { cookies: { rb_board, rb_admin } })
  assert.equal(cookieFrom(locked, 'rb_admin'), '')
  assert.equal(cookieFrom(locked, 'rb_board'), '')
})

test('a room may serve several classes', async () => {
  const rb_board = await pinCookie()
  const cookies = { rb_board }
  const klassId = (name: string) => board.loadState(db).klasses.find((k) => k.name === name)!.id
  const kidOf = (klassId: string) =>
    board.loadState(db).kids.find((k) => k.klassId === klassId && k.currentRoomId === null)!

  const created = await call('POST', '/rooms', {
    cookies,
    body: { name: 'Cluster-Ecke', emoji: '🧩', capacity: 4, scope: [klassId('1A'), klassId('1B')] },
  })
  assert.equal(created.status, 200)
  const room = board.loadState(db).rooms.find((r) => r.name === 'Cluster-Ecke')!
  assert.deepEqual(room.scope, [klassId('1A'), klassId('1B')])

  // both member classes may book, a third one is refused
  const inA = await call('POST', '/book', { cookies, body: { kidId: kidOf(klassId('1A')).id, roomId: room.id } })
  assert.equal(inA.status, 200)
  const inB = await call('POST', '/book', { cookies, body: { kidId: kidOf(klassId('1B')).id, roomId: room.id } })
  assert.equal(inB.status, 200)
  const refused = await call('POST', '/book', { cookies, body: { kidId: kidOf(klassId('2A')).id, roomId: room.id } })
  assert.equal(refused.status, 409)

  // the old single-string shape (a pre-list client) still works
  const patched = await call('PATCH', `/rooms/${room.id}`, { cookies, body: { scope: klassId('1A') } })
  assert.equal(patched.status, 200)
  assert.deepEqual(board.loadState(db).rooms.find((r) => r.id === room.id)!.scope, [klassId('1A')])
})

test('deleting a class trims the scope lists and drops emptied rooms', async () => {
  const rb_board = await pinCookie()
  const cookies = { rb_board }

  for (const name of ['5A', '5B'])
    assert.equal((await call('POST', '/klasses', { cookies, body: { name } })).status, 200)
  const id5A = board.loadState(db).klasses.find((k) => k.name === '5A')!.id
  const id5B = board.loadState(db).klasses.find((k) => k.name === '5B')!.id

  for (const [name, scope] of [['Nur 5A', [id5A]], ['Beide', [id5A, id5B]]] as const) {
    const res = await call('POST', '/rooms', { cookies, body: { name, emoji: '🧩', capacity: 3, scope } })
    assert.equal(res.status, 200)
  }

  assert.equal((await call('DELETE', `/klasses/${id5A}`, { cookies })).status, 200)
  const after = board.loadState(db)
  assert.ok(!after.rooms.some((r) => r.name === 'Nur 5A'), 'room scoped to only 5A goes with the class')
  assert.deepEqual(after.rooms.find((r) => r.name === 'Beide')!.scope, [id5B], '5B is kept')
})

// last: the throttle blocks this board for 15 minutes once it trips
test('password guessing on the credential endpoints is throttled', async () => {
  const cookies = { rb_admin: await adminCookie() }
  for (let i = 0; i < 5; i++) {
    const res = await call('POST', '/change-password', {
      cookies,
      body: { current: `versuch-${i}`, next: 'ein-neues-passwort' },
    })
    assert.equal(res.status, 401)
  }
  const blocked = await call('POST', '/change-password', {
    cookies,
    body: { current: PASSWORD, next: 'ein-neues-passwort' },
  })
  assert.equal(blocked.status, 429)
})
