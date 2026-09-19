// Multiple admin accounts per school: the owner manages the roster, an admin
// does not, the invariants hold (at least one active owner, no self-demote), a
// deactivated account's cookie dies at once, and the migration adopts a legacy
// single login as the owner. Env before the module imports, as in access.test.
import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DATA = mkdtempSync(path.join(tmpdir(), 'lb-accounts-'))
const TENANT = 'kontoschule'
const PIN = '4711'
const OWNER = 'inhaber@example.org'
const OWNER_PW = 'ein-langes-passwort'

process.env.RAUMBOARD_DATA = DATA
process.env.RAUMBOARD_DEFAULT_TENANT = TENANT
process.env.RAUMBOARD_DEMO_TENANT = ''
process.env.RAUMBOARD_NO_LISTEN = '1'
process.env.RAUMBOARD_SECRET = 'test-secret-test-secret-test-secret'

const { openTenant } = await import('./tenant')
const board = await import('./board')
const { hashSecret } = await import('./auth')
const { migrate } = await import('./migrations')

const db = openTenant(TENANT, { create: true })
board.createUser(db, OWNER, hashSecret(OWNER_PW), 'owner')
board.setConfig(db, 'pin_hash', hashSecret(PIN))
board.setConfig(db, 'pin_length', String(PIN.length))

const { app } = await import('./index')

test.after(() => rmSync(DATA, { recursive: true, force: true }))

function call(
  method: string,
  p: string,
  { body, cookies = {}, teacher }: { body?: object; cookies?: Record<string, string>; teacher?: string } = {},
) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return app.request(`/api${p}`, {
    method,
    headers: {
      host: `${TENANT}.raumboard.de`,
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(teacher ? { 'X-Raumboard-Teacher': teacher } : {}),
    },
    body: body === undefined ? (method === 'POST' ? '{}' : undefined) : JSON.stringify(body),
  })
}

function cookieFrom(res: Response, name: string): string {
  const header = res.headers.getSetCookie().find((h) => h.startsWith(`${name}=`))
  assert.ok(header, `no Set-Cookie for ${name}`)
  return header.slice(name.length + 1).split(';')[0]
}

async function deviceCookie(): Promise<string> {
  const res = await call('POST', '/pin', { body: { pin: PIN } })
  assert.equal(res.status, 200)
  return cookieFrom(res, 'rb_board')
}

async function teacherToken(rb_board: string): Promise<string> {
  const res = await call('POST', '/teacher/verify', { cookies: { rb_board }, body: { pin: PIN } })
  assert.equal(res.status, 200)
  return ((await res.json()) as { token: string }).token
}

async function ownerAuth() {
  const rb_board = await deviceCookie()
  const res = await call('POST', '/login', {
    cookies: { rb_board },
    body: { email: OWNER, password: OWNER_PW },
  })
  assert.equal(res.status, 200)
  return {
    cookies: { rb_board, rb_admin: cookieFrom(res, 'rb_admin') },
    teacher: await teacherToken(rb_board),
  }
}

/** Create and sign in a fresh account with the complete device context. */
async function makeAdmin(email: string, role = 'admin') {
  const owner = await ownerAuth()
  const created = await call('POST', '/accounts', {
    ...owner,
    body: { email, role },
  })
  assert.equal(created.status, 200)
  const data = (await created.json()) as { account: { id: string }; password: string }
  const rb_board = owner.cookies.rb_board
  const login = await call('POST', '/login', {
    cookies: { rb_board },
    body: { email, password: data.password },
  })
  assert.equal(login.status, 200)
  return {
    id: data.account.id,
    cookies: { rb_board, rb_admin: cookieFrom(login, 'rb_admin') },
    teacher: owner.teacher,
  }
}

async function isAdminOf(cookies: Record<string, string>): Promise<boolean> {
  const res = await call('GET', '/state', { cookies })
  return ((await res.json()) as { meta: { isAdmin: boolean } }).meta.isAdmin
}

test('an owner adds an account and its password is returned once', async () => {
  const auth = await ownerAuth()
  const res = await call('POST', '/accounts', {
    ...auth,
    body: { email: 'Lehrkraft@Example.ORG', role: 'admin' },
  })
  assert.equal(res.status, 200)
  const data = (await res.json()) as { account: { email: string; role: string }; password: string }
  assert.equal(data.account.email, 'lehrkraft@example.org') // normalized
  assert.equal(data.account.role, 'admin')
  assert.ok(data.password.length >= 8)

  // the new account can sign in with the shown password
  const login = await call('POST', '/login', {
    cookies: { rb_board: auth.cookies.rb_board },
    body: { email: 'lehrkraft@example.org', password: data.password },
  })
  assert.equal(login.status, 200)

  const list = await call('GET', '/accounts', auth)
  const accounts = ((await list.json()) as { accounts: { email: string }[] }).accounts
  assert.ok(accounts.some((a) => a.email === 'lehrkraft@example.org'))
})

test('a duplicate email is refused', async () => {
  const auth = await ownerAuth()
  const res = await call('POST', '/accounts', {
    ...auth,
    body: { email: OWNER, role: 'admin' },
  })
  assert.equal(res.status, 409)
})

test('an admin account cannot reach the roster, but can import', async () => {
  const admin = await makeAdmin('rosterless@example.org')

  assert.equal((await call('GET', '/accounts', admin)).status, 403)
  assert.equal(
    (await call('POST', '/accounts', { ...admin, body: { email: 'y@example.org' } })).status,
    403,
  )
  // the account level still opens the import
  const imported = await call('POST', '/admin/import', {
    ...admin,
    body: { kids: [{ name: 'Neu N.', symbol: '🐝', klass: '1A' }], mode: 'append', targetKlass: null },
  })
  assert.equal(imported.status, 200)
})

test('the last active owner cannot be demoted or deactivated', async () => {
  const auth = await ownerAuth()
  const list = ((await (await call('GET', '/accounts', auth)).json()) as {
    accounts: { id: string; role: string }[]
  }).accounts
  const owner = list.find((a) => a.role === 'owner')!

  assert.equal((await call('PATCH', `/accounts/${owner.id}`, { ...auth, body: { role: 'admin' } })).status, 409)
  assert.equal((await call('PATCH', `/accounts/${owner.id}`, { ...auth, body: { active: false } })).status, 409)
})

test('deactivating an account kills its cookie at once', async () => {
  const temp = await makeAdmin('temp@example.org')
  assert.equal(await isAdminOf(temp.cookies), true)

  const owner = await ownerAuth()
  const deact = await call('PATCH', `/accounts/${temp.id}`, {
    ...owner,
    body: { active: false },
  })
  assert.equal(deact.status, 200)

  // same still-signed cookie, now dead because the account is resolved per request
  assert.equal(await isAdminOf(temp.cookies), false)
})

test('resetting a password issues a new one and revokes the old', async () => {
  const owner = await ownerAuth()
  const created = await call('POST', '/accounts', { ...owner, body: { email: 'reset@example.org' } })
  const first = ((await created.json()) as { account: { id: string }; password: string })

  const reset = await call('POST', `/accounts/${first.account.id}/reset-password`, owner)
  assert.equal(reset.status, 200)
  const second = ((await reset.json()) as { password: string }).password
  assert.notEqual(second, first.password)

  assert.equal(
    (await call('POST', '/login', { cookies: { rb_board: owner.cookies.rb_board }, body: { email: 'reset@example.org', password: first.password } })).status,
    401,
  )
  assert.equal(
    (await call('POST', '/login', { cookies: { rb_board: owner.cookies.rb_board }, body: { email: 'reset@example.org', password: second } })).status,
    200,
  )
})

test('migration 0002 adopts a legacy single login as the owner', () => {
  const p = path.join(DATA, 'legacy.db')
  const raw = new Database(p)
  raw.pragma('foreign_keys = ON')
  raw.exec(readFileSync(path.join(HERE, 'migrations', '0001_init.sql'), 'utf8'))
  raw.pragma('user_version = 1') // legacy shape: schema present, no tracking table
  raw.prepare("INSERT INTO config (key, value) VALUES ('admin_email', ?)").run('Chef@Example.ORG')
  raw.prepare("INSERT INTO config (key, value) VALUES ('admin_hash', ?)").run('scrypt-fake-hash')

  migrate(raw, 'legacy') // real migrations dir → 0002 runs and adopts

  const users = board.listUsers(raw)
  assert.equal(users.length, 1)
  assert.equal(users[0].role, 'owner')
  assert.equal(users[0].email, 'chef@example.org') // lower()ed by the migration
  assert.equal(board.getPassHash(raw, users[0].id), 'scrypt-fake-hash')
  // the old config keys are gone: the users table is the single source now
  assert.equal(board.getConfig(raw, 'admin_email'), undefined)
  assert.equal(board.getConfig(raw, 'admin_hash'), undefined)
  raw.close()
})
