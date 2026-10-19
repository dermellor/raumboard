import test from 'node:test'
import assert from 'node:assert/strict'
import { isOperatorPath } from '../src/operatorPath'

test('operator route works at the root and below a preview base path', () => {
  assert.equal(isOperatorPath('/operator', '/'), true)
  assert.equal(isOperatorPath('/previews/raumboard-3/operator', '/previews/raumboard-3/'), true)
})

test('operator route does not match board or similarly named paths', () => {
  assert.equal(isOperatorPath('/previews/raumboard-3/', '/previews/raumboard-3/'), false)
  assert.equal(isOperatorPath('/previews/raumboard-3/operator-extra', '/previews/raumboard-3/'), false)
  assert.equal(isOperatorPath('/operator', '/previews/raumboard-3/'), false)
})
