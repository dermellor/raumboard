// The symbols setting is school-wide display config: OpenMoji by default, the
// school may switch to the device's own emoji in the Verwaltung. Worth testing
// on their own: the default without any config row, the value in /api/state,
// and that the change is PIN-level like the rest of the Verwaltung (a signed-in
// account without the PIN may not flip it, and garbage is refused).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DATA = mkdtempSync(path.join(tmpdir(), 'lb-symbols-'))
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

function call(
  method: string,
  path: string,
  { body, cookies = {}, teacher }: { body?: object; cookies?: Record<string, string>; teacher?: string } = {},
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

async function pinCookie(): Promise<string> {
  const res = await call('POST', '/pin', { body: { pin: PIN } })
  assert.equal(res.status, 200)
  return cookieFrom(res, 'rb_board')
}

async function teacherToken(rb_board: string): Promise<string> {
  const res = await call('POST', '/teacher/verify', { cookies: { rb_board }, body: { pin: PIN } })
  assert.equal(res.status, 200)
  return ((await res.json()) as { token: string }).token
}

async function symbolsOf(rb_board: string): Promise<'openmoji' | 'native'> {
  const body = (await (await call('GET', '/state', { cookies: { rb_board } })).json()) as {
    meta: { symbols: 'openmoji' | 'native' }
  }
  return body.meta.symbols
}

test('default is OpenMoji', async () => {
  assert.equal(await symbolsOf(await pinCookie()), 'openmoji')
})

test('changing symbols needs an unlocked device and a Verwaltung confirmation', async () => {
  const pin = await pinCookie()
  const teacher = await teacherToken(pin)
  const adminLogin = await call('POST', '/login', {
    cookies: { rb_board: pin },
    body: { email: EMAIL, password: PASSWORD },
  })
  assert.equal(adminLogin.status, 200)
  const admin = cookieFrom(adminLogin, 'rb_admin')
  assert.equal(
    (await call('POST', '/symbols', { body: { symbols: 'native' }, cookies: { rb_board: pin, rb_admin: admin } })).status,
    403,
  )

  assert.equal((await call('POST', '/symbols', { body: { symbols: 'openmoji' } })).status, 401)

  assert.equal(
    (await call('POST', '/symbols', { body: { symbols: 'native' }, cookies: { rb_board: pin }, teacher })).status,
    200,
  )
  assert.equal(await symbolsOf(pin), 'native')
})

test('garbage values are refused and change nothing', async () => {
  const pin = await pinCookie()
  const teacher = await teacherToken(pin)
  assert.equal(
    (await call('POST', '/symbols', { body: { symbols: 'twemoji' }, cookies: { rb_board: pin }, teacher })).status,
    400,
  )
  assert.equal(await symbolsOf(pin), 'native')
})

// The library itself must be served: on 2026-09-11 the boards on the demo
// host showed broken images, because the static whitelist knew /assets/* and
// the favicon but not the new /emoji/ directory, so its files fell through to
// the SPA. Skipped without a build, since dist/ is the build output.
test('serves the bundled OpenMoji library', async (t) => {
  if (!existsSync(path.join('dist', 'emoji', '1F431.svg'))) return t.skip('no build output to serve')
  const res = await app.request('/emoji/1F431.svg', {
    headers: { host: `${TENANT}.raumboard.de` },
  })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /svg/)
})
