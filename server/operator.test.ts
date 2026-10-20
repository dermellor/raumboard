import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DATA = mkdtempSync(path.join(tmpdir(), 'rb-operator-'))
const REGISTRY = path.join(DATA, 'operator-instances.json')
process.env.RAUMBOARD_DATA = DATA
process.env.RAUMBOARD_OPERATOR_REGISTRY = REGISTRY
process.env.RAUMBOARD_OPERATOR_PASSWORD = 'operator-test-passwort'
process.env.RAUMBOARD_OPERATOR_CACHE_MS = '0'
process.env.RAUMBOARD_NO_LISTEN = '1'
process.env.RAUMBOARD_SECRET = 'operator-test-secret-with-enough-entropy'
process.env.RAUMBOARD_DEFAULT_TENANT = ''
process.env.RAUMBOARD_DEMO_TENANT = ''

writeFileSync(REGISTRY, JSON.stringify([
  { slug: 'aktiv', schoolName: 'Aktive Grundschule', backup: { status: 'ok', at: '2026-10-18T02:30:00.000Z' }, version: '2.4.0' },
  { slug: 'start', schoolName: 'Neue Schule', onboarding: true },
  { slug: 'kaputt', schoolName: 'Fehlerhafte Schule' },
]))

const { openTenant } = await import('./tenant')
const board = await import('./board')
const { buildSeed } = await import('../src/seed')
const operator = await import('./operator')
const { app } = await import('./index')

const active = openTenant('aktiv', { create: true })
board.replaceAll(active, buildSeed())
const onboarding = openTenant('start', { create: true })
board.setConfig(onboarding, 'school_name', 'Neue Schule')

function cookieFrom(response: Response, name: string): string {
  const value = response.headers.getSetCookie().find((header) => header.startsWith(`${name}=`))
  assert.ok(value)
  return value.slice(name.length + 1).split(';')[0]
}

test.after(() => rmSync(DATA, { recursive: true, force: true }))

test('usage aggregation counts distinct boards and activities in the seven-day window', () => {
  active.prepare("INSERT INTO usage_events (occurred_at, kind, board_hash) VALUES (?, 'app_open', ?), (?, 'app_open', ?), (?, 'app_open', ?), (?, 'activity', NULL), (?, 'activity', NULL)")
    .run('2026-10-17T10:00:00.000Z', 'board-a', '2026-10-17T11:00:00.000Z', 'board-a', '2026-10-16T10:00:00.000Z', 'board-b', '2026-10-17T12:00:00.000Z', '2026-10-17T13:00:00.000Z')
  active.prepare("INSERT INTO usage_events (occurred_at, kind, board_hash) VALUES ('2026-09-01T00:00:00.000Z', 'activity', NULL)").run()
  assert.deepEqual(operator.collectUsage(active, 'aktiv', new Date('2026-10-18T12:00:00.000Z')), {
    activeBoards7d: 2,
    activities7d: 2,
    lastActivity: '2026-10-17T13:00:00.000Z',
  })
})

test('status derivation prioritizes database errors and onboarding and detects backup/activity warnings', () => {
  const empty = { activeBoards7d: 0, activities7d: 0, lastActivity: null }
  assert.equal(operator.deriveStatus({ slug: 'a', schoolName: 'A' }, empty, true).status, 'error')
  assert.equal(operator.deriveStatus({ slug: 'a', schoolName: 'A', onboarding: true }, empty, true).status, 'error')
  assert.equal(operator.deriveStatus({ slug: 'a', schoolName: 'A', onboarding: true }, empty).status, 'onboarding')
  assert.equal(operator.deriveStatus({ slug: 'a', schoolName: 'A', backup: { status: 'failed' } }, empty).status, 'attention')
  assert.equal(operator.deriveStatus({ slug: 'a', schoolName: 'A' }, { ...empty, lastActivity: '2026-09-01T00:00:00.000Z' }, false, new Date('2026-10-18')).status, 'attention')
})

test('operator API rejects school cookies and accepts only an operator login', async () => {
  const denied = await app.request('/api/operator/overview', { headers: { cookie: 'rb_admin=anything; rb_board=anything' } })
  assert.equal(denied.status, 401)

  const wrong = await app.request('/api/operator/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'falsch' }) })
  assert.equal(wrong.status, 401)

  const login = await app.request('/api/operator/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'operator-test-passwort' }) })
  assert.equal(login.status, 200)
  const cookie = cookieFrom(login, 'rb_operator')
  const overview = await app.request('/api/operator/overview', { headers: { cookie: `rb_operator=${cookie}` } })
  assert.equal(overview.status, 200)
  const payload = await overview.json() as ReturnType<typeof operator.platformSnapshot>
  assert.equal(payload.kpis.instances, 3)
  assert.equal(payload.instances.find((item) => item.slug === 'start')?.status, 'onboarding')
  assert.equal(payload.instances.find((item) => item.slug === 'kaputt')?.status, 'error')
})

test('maintenance endpoint updates the registry', async () => {
  const login = await app.request('/api/operator/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'operator-test-passwort' }) })
  const cookie = cookieFrom(login, 'rb_operator')
  const response = await app.request('/api/operator/instances/aktiv/maintenance', { method: 'POST', headers: { cookie: `rb_operator=${cookie}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) })
  assert.equal(response.status, 200)
  assert.equal(operator.platformSnapshot().instances.find((item) => item.slug === 'aktiv')?.maintenance, true)
})
