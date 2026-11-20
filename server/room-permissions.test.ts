import test from 'node:test'
import assert from 'node:assert/strict'
import { canDeleteRooms } from '../src/roomPermissions'

test('room deletion is hidden without an active account', () => {
  assert.equal(canDeleteRooms({ isAdmin: false, account: null }), false)
  assert.equal(canDeleteRooms({ isAdmin: false, account: { email: 'old@example.org', role: 'admin' } }), false)
})

test('room deletion is visible to active admin and owner accounts', () => {
  assert.equal(canDeleteRooms({ isAdmin: true, account: { email: 'admin@example.org', role: 'admin' } }), true)
  assert.equal(canDeleteRooms({ isAdmin: true, account: { email: 'owner@example.org', role: 'owner' } }), true)
})
