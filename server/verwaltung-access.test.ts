import test from 'node:test'
import assert from 'node:assert/strict'
import { needsTeacherPin } from '../src/verwaltungAccess'

test('Verwaltung asks for the teacher PIN even in an operator dev-open session', () => {
  assert.equal(needsTeacherPin({ mode: 'api', teacherConfirmed: false }), true)
  assert.equal(needsTeacherPin({ mode: 'api', teacherConfirmed: true }), false)
})

test('local demo mode has no teacher PIN gate', () => {
  assert.equal(needsTeacherPin({ mode: 'demo', teacherConfirmed: false }), false)
})
