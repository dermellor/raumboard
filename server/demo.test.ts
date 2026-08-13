// The demo's promises are the thing worth testing: one board per visitor, no
// file anywhere, and a reset that also undoes changed credentials. Env has to be
// set before the modules read it, so they are imported dynamically below.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DATA = mkdtempSync(path.join(tmpdir(), 'lb-demo-'))

process.env.RAUMBOARD_DATA = DATA
process.env.RAUMBOARD_DEMO_TENANT = 'demo'
process.env.RAUMBOARD_DEMO_PASSWORD = 'geheim-demo'
process.env.RAUMBOARD_DEMO_PIN = '4321'
process.env.RAUMBOARD_DEMO_MAX_BOARDS = '2'
process.env.RAUMBOARD_DEFAULT_TENANT = ''

const { demoBoardId, demoBoardCount, isDemoBoard, isSession, newSession, openDemoBoard, resetDemoBoard, sweepDemoBoards } =
  await import('./demo')
const { openTenant } = await import('./tenant')
const board = await import('./board')
const { verifySecret } = await import('./auth')

test.after(() => rmSync(DATA, { recursive: true, force: true }))

/** Start from no boards: the module is shared by every test in this file. */
function clear() {
  sweepDemoBoards(Date.now() + 10 * 365 * 24 * 3600_000)
  assert.equal(demoBoardCount(), 0)
}

const someKid = (db: any) => board.loadState(db).kids[0]
const someRoom = (db: any) => board.loadState(db).rooms.find((r) => r.isOpen && r.scope === 'all')!

test('a session id round-trips into a board id, and only a real one is accepted', () => {
  const session = newSession()
  assert.ok(isSession(session))
  assert.ok(isDemoBoard(demoBoardId(session)))
  assert.equal(isSession('kurz'), false)
  assert.equal(isSession(undefined), false)
  // a school slug is not a demo board
  assert.equal(isDemoBoard('beispielschule'), false)
})

test('two visitors get separate boards, and nothing reaches the disk', () => {
  clear()
  const a = openDemoBoard(demoBoardId(newSession()))
  const b = openDemoBoard(demoBoardId(newSession()))
  assert.equal(demoBoardCount(), 2)

  const kid = someKid(a)
  const result = board.book(a, kid.id, someRoom(a).id)
  assert.ok(result.ok)

  assert.notEqual(board.loadState(a).kids.find((k) => k.id === kid.id)!.currentRoomId, null)
  assert.equal(board.loadState(b).kids.find((k) => k.id === kid.id)!.currentRoomId, null)

  assert.deepEqual(readdirSync(DATA), [])
})

test('the same session keeps its board across requests', () => {
  clear()
  const id = demoBoardId(newSession())
  const kid = someKid(openDemoBoard(id))
  board.book(openDemoBoard(id), kid.id, someRoom(openDemoBoard(id)).id)
  assert.equal(demoBoardCount(), 1)
  assert.notEqual(board.loadState(openDemoBoard(id)).kids.find((k) => k.id === kid.id)!.currentRoomId, null)
})

test('reset restores the seed and the published credentials', () => {
  clear()
  const id = demoBoardId(newSession())
  const db = openDemoBoard(id)
  const kidCount = board.loadState(db).kids.length

  board.book(db, someKid(db).id, someRoom(db).id)
  board.removeKid(db, someKid(db).id)
  board.setConfig(db, 'admin_hash', 'scrypt:1:1:1:x:y') // as if an admin changed it
  board.setConfig(db, 'school_name', 'Umbenannt')

  resetDemoBoard(id)

  const after = board.loadState(db)
  assert.equal(after.kids.length, kidCount)
  assert.deepEqual(after.kids.filter((k) => k.currentRoomId !== null), [])
  assert.equal(board.getConfig(db, 'school_name'), 'Demoschule')
  assert.equal(board.getConfig(db, 'admin_email'), 'demo@raumboard.de')
  assert.ok(verifySecret('geheim-demo', board.getConfig(db, 'admin_hash')!))
  assert.ok(verifySecret('4321', board.getConfig(db, 'pin_hash')!))
  assert.equal(board.getConfig(db, 'pin_length'), '4')
})

test('boards survive until the idle limit, then the sweeper drops them', () => {
  clear()
  openDemoBoard(demoBoardId(newSession()))
  openDemoBoard(demoBoardId(newSession()))

  // default limit is 60 minutes, and both were touched just now
  assert.equal(sweepDemoBoards(Date.now() + 30 * 60_000), 0)
  assert.equal(demoBoardCount(), 2)

  assert.equal(sweepDemoBoards(Date.now() + 90 * 60_000), 2)
  assert.equal(demoBoardCount(), 0)
})

test('beyond the cap the least recently used board gives way', () => {
  clear()
  const first = demoBoardId(newSession())
  const db = openDemoBoard(first)
  const kid = someKid(db)
  board.book(db, kid.id, someRoom(db).id)
  openDemoBoard(demoBoardId(newSession()))

  openDemoBoard(demoBoardId(newSession())) // cap is 2 → `first` is dropped
  assert.equal(demoBoardCount(), 2)

  // reopening it yields a fresh board, so the booking is gone
  const back = openDemoBoard(first)
  assert.equal(board.loadState(back).kids.find((k) => k.id === kid.id)!.currentRoomId, null)
})

test('openTenant refuses the demo slug instead of creating a file for it', () => {
  assert.throws(() => openTenant('demo', { create: true }), /in-memory demo/)
  assert.deepEqual(readdirSync(DATA), [])
})

test('the server refuses to start when the demo slug has a database file', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lb-demo-clash-'))
  writeFileSync(path.join(dir, 'demo.db'), '')
  try {
    assert.throws(
      () =>
        execFileSync(process.execPath, ['--import', 'tsx', path.join(HERE, 'demo.ts')], {
          env: { ...process.env, RAUMBOARD_DATA: dir, RAUMBOARD_DEMO_TENANT: 'demo' },
          stdio: 'pipe',
        }),
      /würde diese Datenbank verdecken/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the server refuses a demo slug that self-hosted mode would shadow', () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, ['--import', 'tsx', path.join(HERE, 'demo.ts')], {
        env: {
          ...process.env,
          RAUMBOARD_DATA: mkdtempSync(path.join(tmpdir(), 'lb-demo-solo-')),
          RAUMBOARD_DEMO_TENANT: 'demo',
          RAUMBOARD_DEFAULT_TENANT: 'beispielschule',
        },
        stdio: 'pipe',
      }),
    /bliebe unerreichbar/,
  )
})
