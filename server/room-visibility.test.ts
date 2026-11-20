import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { visibleOnKidsBoards } from '../src/boardLogic'
import type { Room } from '../src/types'
import { migrate } from './migrations'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DATA = mkdtempSync(path.join(tmpdir(), 'rb-room-visibility-'))

process.env.RAUMBOARD_DATA = DATA
const { openTenant } = await import('./tenant')
const board = await import('./board')

test.after(() => rmSync(DATA, { recursive: true, force: true }))

function room(patch: Partial<Room> = {}): Room {
  return {
    id: 'raum', name: 'Raum', emoji: '🚪', capacity: 4, isOpen: false,
    boardVisibility: 'always', scope: 'all', ...patch,
  }
}

test('Kinder-Tafeln zeigen geschlossene Räume nur gemäß ihrer Anzeigeoption', () => {
  assert.equal(visibleOnKidsBoards(room({ boardVisibility: 'always' })), true)
  assert.equal(visibleOnKidsBoards(room({ boardVisibility: 'open-only' })), false)
  assert.equal(visibleOnKidsBoards(room({ isOpen: true, boardVisibility: 'open-only' })), true)
  assert.equal(visibleOnKidsBoards(room({ boardVisibility: undefined })), true)
})

test('neue Räume speichern Immer anzeigen als Standard und beide Varianten dauerhaft', () => {
  const db = openTenant('neu', { create: true })
  board.addRoom(db, 'Standard', '🚪', 4, 'all')
  board.addRoom(db, 'Nur offen', '🔓', 4, 'all', undefined, 'open-only')

  let rooms = board.loadState(db).rooms
  assert.equal(rooms.find((r) => r.name === 'Standard')?.boardVisibility, 'always')
  assert.equal(rooms.find((r) => r.name === 'Nur offen')?.boardVisibility, 'open-only')

  const id = rooms.find((r) => r.name === 'Standard')!.id
  board.updateRoom(db, id, { boardVisibility: 'open-only', isOpen: false })
  rooms = board.loadState(db).rooms
  assert.equal(rooms.find((r) => r.id === id)?.boardVisibility, 'open-only')
  assert.equal(rooms.find((r) => r.id === id)?.isOpen, false)
  db.close()
})

test('Migration übernimmt bestehende Räume rückwärtskompatibel als Immer anzeigen', () => {
  const db = new Database(path.join(DATA, 'legacy-visibility.db'))
  const migrations = path.join(HERE, 'migrations')
  db.exec(readFileSync(path.join(migrations, '0001_init.sql'), 'utf8'))
  db.prepare("INSERT INTO rooms (id, name, emoji, capacity, is_open, scope) VALUES ('alt', 'Alt', '🚪', 3, 0, 'all')").run()
  db.pragma('user_version = 1')

  migrate(db, 'legacy-visibility')

  const row = db.prepare("SELECT board_visibility FROM rooms WHERE id = 'alt'").get() as { board_visibility: string }
  assert.equal(row.board_visibility, 'always')
  assert.equal(board.loadState(db).rooms[0].boardVisibility, 'always')
  db.close()
})
