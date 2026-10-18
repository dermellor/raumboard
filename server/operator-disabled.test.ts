import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DATA = mkdtempSync(path.join(tmpdir(), 'rb-no-operator-'))
process.env.RAUMBOARD_DATA = DATA
process.env.RAUMBOARD_NO_LISTEN = '1'
process.env.RAUMBOARD_SECRET = 'no-operator-test-secret-with-entropy'
process.env.RAUMBOARD_DEFAULT_TENANT = ''
process.env.RAUMBOARD_DEMO_TENANT = ''
delete process.env.RAUMBOARD_OPERATOR_PASSWORD
delete process.env.RAUMBOARD_OPERATOR_PASSWORD_HASH

const { app } = await import('./index')
test.after(() => rmSync(DATA, { recursive: true, force: true }))

test('self-host setup without operator credentials exposes neither API nor page', async () => {
  const api = await app.request('/api/operator/overview')
  assert.equal(api.status, 404)
  const page = await app.request('/operator', { headers: { host: 'raumboard.de' } })
  assert.equal(page.status, 404)
})
