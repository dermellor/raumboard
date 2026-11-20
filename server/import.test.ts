// A re-import in replace mode must keep the symbol of a kid that returns under
// the same name in the same class: schools import corrected class lists, and
// without this rule every re-import flattens hand-assigned symbols back to the
// fallback (the Franziskus instance ended up with the star for all 333 kids
// that way). The wizard's preview follows the same rule (prepareKids below), so
// the school sees exactly what the import will do.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DATA = mkdtempSync(path.join(tmpdir(), 'lb-import-'))
const TENANT = 'importschule'

process.env.RAUMBOARD_DATA = DATA
process.env.RAUMBOARD_DEFAULT_TENANT = TENANT
process.env.RAUMBOARD_DEMO_TENANT = ''
process.env.RAUMBOARD_NO_LISTEN = '1'
process.env.RAUMBOARD_SECRET = 'test-secret-test-secret-test-secret'

const { openTenant } = await import('./tenant')
const board = await import('./board')
const { prepareKids } = await import('../src/import/parse')

const db = openTenant(TENANT, { create: true })

test.after(() => rmSync(DATA, { recursive: true, force: true }))

function kidBy(name: string) {
  return board.loadState(db).kids.find((k) => k.name === name)
}

test('a replace import keeps the symbol of a kid returning under the same name', () => {
  board.importKids(db, [{ name: 'Ada L.', symbol: '🦊', klass: '1A' }], null, 'append')
  const kid = kidBy('Ada L.')
  assert.ok(kid)
  board.updateKid(db, kid.id, { symbol: '🐢' }) // a teacher picked this one by hand
  // the re-import sends a different symbol: the kept one wins
  board.importKids(db, [{ name: 'Ada L.', symbol: '🦊', klass: '1A' }], null, 'replace')
  assert.equal(kidBy('Ada L.')?.symbol, '🐢')
})

test('a replace import drops kids that left and keeps other classes untouched', () => {
  board.importKids(
    db,
    [
      { name: 'Ben M.', symbol: '🦦', klass: '2A' },
      { name: 'Cleo R.', symbol: '🦌', klass: '2A' },
      { name: 'Dina S.', symbol: '🐬', klass: '2B' },
    ],
    null,
    'append',
  )
  // 2A re-imported with only Ben still on the list
  board.importKids(db, [{ name: 'Ben M.', symbol: '🦊', klass: '2A' }], null, 'replace')
  const kids = board.loadState(db).kids
  assert.deepEqual(kids.filter((k) => k.name === 'Cleo R.'), [])
  assert.equal(kids.find((k) => k.name === 'Dina S.')?.symbol, '🐬')
  assert.equal(kids.find((k) => k.name === 'Ben M.')?.symbol, '🦦')
})

test('a new kid gets its imported symbol, the fallback star only without one', () => {
  board.importKids(
    db,
    [
      { name: 'Emil T.', symbol: '', klass: '3A' },
      { name: 'Fina U.', symbol: '🦉', klass: '3A' },
    ],
    null,
    'append',
  )
  assert.equal(kidBy('Emil T.')?.symbol, '⭐')
  assert.equal(kidBy('Fina U.')?.symbol, '🦉')
})

test('the import preview keeps a same-name kid symbol in replace mode', () => {
  const table = {
    headers: ['Vorname', 'Nachname', 'Klasse'],
    rows: [
      ['Ada', 'Lovelace', '1A'],
      ['Neu', 'Kind', '1A'],
    ],
  }
  const keep = { symbols: new Map([['1a|Ada L.', '🐢']]), defaultKlass: null }
  const prepared = prepareKids(table, { firstName: 0, lastName: 1, klass: 2 }, new Set(['🐢']), keep)
  assert.equal(prepared[0].symbol, '🐢') // kept, not re-assigned
  assert.notEqual(prepared[1].symbol, '🐢') // the new kid gets a fresh emoji
  assert.notEqual(prepared[1].symbol, '⭐') // the pool has room here
})

test('the import preview keys the target class when the list has no class column', () => {
  const table = { headers: ['Vorname', 'Nachname'], rows: [['Ada', 'Lovelace']] }
  const keep = { symbols: new Map([['1a|Ada L.', '🐢']]), defaultKlass: '1a' }
  const prepared = prepareKids(table, { firstName: 0, lastName: 1 }, new Set(['🐢']), keep)
  assert.equal(prepared[0].symbol, '🐢')
})

test('without keep the preview assigns fresh pool emojis as before', () => {
  const table = { headers: ['Vorname', 'Nachname'], rows: [['Ada', 'Lovelace']] }
  const prepared = prepareKids(table, { firstName: 0, lastName: 1 }, new Set())
  assert.equal(prepared[0].name, 'Ada L.')
  assert.notEqual(prepared[0].symbol, '⭐')
  assert.notEqual(prepared[0].symbol, '🐢')
})
