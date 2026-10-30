// The operator dev-open flow: the cockpit mints a short-lived link, the link
// buys the three cookies of an unlocked session (device, owner, dev marker),
// and the dev marker carries the school's PIN and password gates past every
// ask. Env has to be set before the modules read it, so they are imported below.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DATA = mkdtempSync(path.join(tmpdir(), 'lb-dev-open-'))
const TENANT = 'testschule'
const PIN = '4711'
const EMAIL = 'leitung@testschule.example'

process.env.RAUMBOARD_DATA = DATA
process.env.RAUMBOARD_DEFAULT_TENANT = TENANT
process.env.RAUMBOARD_DEMO_TENANT = ''
process.env.RAUMBOARD_NO_LISTEN = '1'
process.env.RAUMBOARD_SECRET = 'test-secret-test-secret-test-secret'
process.env.RAUMBOARD_OPERATOR_PASSWORD = 'operator-test-passwort'
process.env.RAUMBOARD_OPERATOR_CACHE_MS = '0'

const { openTenant } = await import('./tenant')
const board = await import('./board')
const { hashSecret } = await import('./auth')
const { buildSeed } = await import('../src/seed')

const db = openTenant(TENANT, { create: true })
board.replaceAll(db, buildSeed())
board.createUser(db, EMAIL, hashSecret('ein-langes-passwort'), 'owner')
board.setConfig(db, 'pin_hash', hashSecret(PIN))
board.setConfig(db, 'pin_length', String(PIN.length))

const { app } = await import('./index')

test.after(() => rmSync(DATA, { recursive: true, force: true }))

function cookieFrom(response: Response, name: string): string {
  const value = response.headers.getSetCookie().find((header) => header.startsWith(`${name}=`))
  assert.ok(value, `cookie ${name} fehlt`)
  return value.slice(name.length + 1).split(';')[0]
}

test('an operator dev link unlocks the school without PIN or password', async () => {
  const login = await app.request('/api/operator/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'operator-test-passwort' }),
  })
  const operatorCookie = cookieFrom(login, 'rb_operator')

  // minting needs the operator session
  const denied = await app.request(`/api/operator/instances/${TENANT}/dev-link`, { method: 'POST' })
  assert.equal(denied.status, 401)

  const link = await app.request(`/api/operator/instances/${TENANT}/dev-link`, {
    method: 'POST',
    headers: { cookie: `rb_operator=${operatorCookie}` },
  })
  assert.equal(link.status, 200)
  const { url } = await link.json() as { url: string }
  assert.match(url, new RegExp(`^https://${TENANT}\\.raumboard\\.de/api/dev-open\\?token=`))

  // opening the link exchanges the token for the three session cookies
  const opened = await app.request(new URL(url).pathname + new URL(url).search)
  assert.equal(opened.status, 302)
  assert.equal(opened.headers.get('location'), '/')
  const cookies = {
    rb_board: cookieFrom(opened, 'rb_board'),
    rb_admin: cookieFrom(opened, 'rb_admin'),
    rb_dev: cookieFrom(opened, 'rb_dev'),
  }
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')

  // the board is unlocked and reports the dev session
  const state = await app.request('/api/state', { headers: { cookie: cookieHeader } })
  const payload = await state.json() as { meta: { deviceUnlocked: boolean; devOpen?: boolean; isAdmin: boolean } }
  assert.equal(payload.meta.deviceUnlocked, true)
  assert.equal(payload.meta.devOpen, true)
  assert.equal(payload.meta.isAdmin, true)

  // owner routes open without a teacher token (the dev marker stands in)
  const accounts = await app.request('/api/accounts', { headers: { cookie: cookieHeader } })
  assert.equal(accounts.status, 200)
  assert.equal((await accounts.json() as { accounts: { email: string }[] }).accounts[0].email, EMAIL)

  // the school's password is not asked for, and a wrong one still counts as ok
  const verify = await app.request('/api/verify-password', {
    method: 'POST',
    headers: { cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'falsch' }),
  })
  assert.equal(verify.status, 200)
})

test('an expired or forged dev link opens nothing', async () => {
  const bogus = await app.request('/api/dev-open?token=eine-schlechte-faelschung')
  assert.equal(bogus.status, 401)
  const setCookies = bogus.headers.getSetCookie()
  assert.equal(setCookies.filter((header) => header.startsWith('rb_board=')).length, 0)
})
