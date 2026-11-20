import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldUseApiStore } from '../src/runtimeMode'

test('server-injected and explicitly configured builds use the API store', () => {
  assert.equal(shouldUseApiStore(true, undefined, '/'), true)
  assert.equal(shouldUseApiStore(false, 'true', '/'), true)
})

test('a static Cockpit preview uses its proxied API', () => {
  assert.equal(shouldUseApiStore(false, undefined, '/previews/raumboard-5/'), true)
  assert.equal(shouldUseApiStore(false, undefined, '/previews/raumboard-5/index.html'), true)
})

test('an ordinary static build remains the local demo', () => {
  assert.equal(shouldUseApiStore(false, undefined, '/'), false)
  assert.equal(shouldUseApiStore(false, 'false', '/showcase/'), false)
})
