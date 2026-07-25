import type Database from 'better-sqlite3'
import { canBook } from '../src/boardLogic'
import type { BoardState, BookResult, Kid, Klass, Room } from '../src/types'

// Server-side board operations. The rules live in src/boardLogic.ts (shared
// with the frontend stores) — this module loads state from SQLite, applies
// the same checks inside a transaction, and writes the result.

export function loadState(db: Database.Database): BoardState {
  const klasses = (db.prepare('SELECT id, name, emoji FROM klasses').all() as any[]).map(
    (r): Klass => ({ id: r.id, name: r.name, emoji: r.emoji ?? undefined }),
  )
  const kids = (
    db.prepare('SELECT id, klass_id, symbol, name, current_room_id FROM kids').all() as any[]
  ).map(
    (r): Kid => ({
      id: r.id,
      klassId: r.klass_id,
      symbol: r.symbol,
      name: r.name,
      currentRoomId: r.current_room_id,
    }),
  )
  const rooms = (
    db.prepare('SELECT id, name, emoji, capacity, is_open, scope FROM rooms').all() as any[]
  ).map(
    (r): Room => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      capacity: r.capacity,
      isOpen: !!r.is_open,
      scope: r.scope,
    }),
  )
  return { klasses, kids, rooms }
}

export function getConfig(db: Database.Database, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setConfig(db: Database.Database, key: string, value: string): void {
  db.prepare(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value)
}

// --- booking ---------------------------------------------------------------

export function book(db: Database.Database, kidId: string, roomId: string): BookResult {
  return db.transaction((): BookResult => {
    const state = loadState(db)
    const kid = state.kids.find((k) => k.id === kidId)
    const room = state.rooms.find((r) => r.id === roomId)
    if (!kid || !room) return { ok: false, reason: 'Kind oder Raum nicht gefunden' }
    const check = canBook(kid, room, state)
    if (!check.ok) return check
    db.prepare('UPDATE kids SET current_room_id = ? WHERE id = ?').run(roomId, kidId)
    return { ok: true }
  })()
}

export function unbook(db: Database.Database, kidId: string): void {
  db.prepare('UPDATE kids SET current_room_id = NULL WHERE id = ?').run(kidId)
}

export function reset(db: Database.Database): void {
  db.prepare('UPDATE kids SET current_room_id = NULL').run()
}

// --- id generation (mirrors the demo store's slug behaviour) ----------------

function slugId(db: Database.Database, name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'x'
  const taken = new Set<string>()
  for (const table of ['klasses', 'kids', 'rooms'])
    for (const row of db.prepare(`SELECT id FROM ${table}`).all() as { id: string }[])
      taken.add(row.id)
  let id = base
  let n = 2
  while (taken.has(id)) id = `${base}-${n++}`
  return id
}

// --- admin CRUD --------------------------------------------------------------

export function addRoom(
  db: Database.Database,
  name: string,
  emoji: string,
  capacity: number,
  scope: string,
): void {
  db.prepare('INSERT INTO rooms (id, name, emoji, capacity, is_open, scope) VALUES (?, ?, ?, ?, 1, ?)').run(
    slugId(db, name),
    name,
    emoji,
    Math.max(0, capacity),
    scope,
  )
}

export function updateRoom(db: Database.Database, roomId: string, patch: Partial<Room>): void {
  const sets: string[] = []
  const args: unknown[] = []
  if (patch.name !== undefined) (sets.push('name = ?'), args.push(patch.name))
  if (patch.emoji !== undefined) (sets.push('emoji = ?'), args.push(patch.emoji))
  if (patch.capacity !== undefined) (sets.push('capacity = ?'), args.push(Math.max(0, patch.capacity)))
  if (patch.isOpen !== undefined) (sets.push('is_open = ?'), args.push(patch.isOpen ? 1 : 0))
  if (patch.scope !== undefined) (sets.push('scope = ?'), args.push(patch.scope))
  if (!sets.length) return
  db.prepare(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`).run(...args, roomId)
}

export function removeRoom(db: Database.Database, roomId: string): void {
  db.transaction(() => {
    db.prepare('UPDATE kids SET current_room_id = NULL WHERE current_room_id = ?').run(roomId)
    db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId)
  })()
}

export function addKid(db: Database.Database, klassId: string, symbol: string, name: string): void {
  db.prepare('INSERT INTO kids (id, klass_id, symbol, name) VALUES (?, ?, ?, ?)').run(
    slugId(db, `${klassId}-${name}`),
    klassId,
    symbol,
    name,
  )
}

export function updateKid(
  db: Database.Database,
  kidId: string,
  patch: Partial<Pick<Kid, 'name' | 'symbol' | 'klassId'>>,
): void {
  db.transaction(() => {
    if (patch.klassId !== undefined) {
      // moving class: a booking in a class-bound room of the old class is no
      // longer legal → back to the classroom (mirrors demo store)
      const kid = db.prepare('SELECT klass_id, current_room_id FROM kids WHERE id = ?').get(kidId) as
        | { klass_id: string; current_room_id: string | null }
        | undefined
      if (kid && kid.current_room_id && patch.klassId !== kid.klass_id) {
        const room = db.prepare('SELECT scope FROM rooms WHERE id = ?').get(kid.current_room_id) as
          | { scope: string }
          | undefined
        if (room && room.scope !== 'all' && room.scope !== patch.klassId)
          db.prepare('UPDATE kids SET current_room_id = NULL WHERE id = ?').run(kidId)
      }
      db.prepare('UPDATE kids SET klass_id = ? WHERE id = ?').run(patch.klassId, kidId)
    }
    if (patch.name !== undefined)
      db.prepare('UPDATE kids SET name = ? WHERE id = ?').run(patch.name, kidId)
    if (patch.symbol !== undefined)
      db.prepare('UPDATE kids SET symbol = ? WHERE id = ?').run(patch.symbol, kidId)
  })()
}

export function removeKid(db: Database.Database, kidId: string): void {
  db.prepare('DELETE FROM kids WHERE id = ?').run(kidId)
}

export function addKlass(db: Database.Database, name: string, emoji?: string): void {
  db.prepare('INSERT INTO klasses (id, name, emoji) VALUES (?, ?, ?)').run(
    slugId(db, name),
    name,
    emoji ?? null,
  )
}

export function updateKlass(
  db: Database.Database,
  klassId: string,
  patch: Partial<Pick<Klass, 'name' | 'emoji'>>,
): void {
  if (patch.name !== undefined)
    db.prepare('UPDATE klasses SET name = ? WHERE id = ?').run(patch.name, klassId)
  if (patch.emoji !== undefined)
    db.prepare('UPDATE klasses SET emoji = ? WHERE id = ?').run(patch.emoji, klassId)
}

export function removeKlass(db: Database.Database, klassId: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM kids WHERE klass_id = ?').run(klassId)
    db.prepare('DELETE FROM rooms WHERE scope = ?').run(klassId)
    db.prepare('DELETE FROM klasses WHERE id = ?').run(klassId)
  })()
}

/** Replace all board data (used by CLI seed). */
export function replaceAll(db: Database.Database, state: BoardState): void {
  db.transaction(() => {
    db.prepare('DELETE FROM kids').run()
    db.prepare('DELETE FROM rooms').run()
    db.prepare('DELETE FROM klasses').run()
    const insKlass = db.prepare('INSERT INTO klasses (id, name, emoji) VALUES (?, ?, ?)')
    const insKid = db.prepare(
      'INSERT INTO kids (id, klass_id, symbol, name, current_room_id) VALUES (?, ?, ?, ?, ?)',
    )
    const insRoom = db.prepare(
      'INSERT INTO rooms (id, name, emoji, capacity, is_open, scope) VALUES (?, ?, ?, ?, ?, ?)',
    )
    for (const c of state.klasses) insKlass.run(c.id, c.name, c.emoji ?? null)
    for (const k of state.kids) insKid.run(k.id, k.klassId, k.symbol, k.name, k.currentRoomId)
    for (const r of state.rooms) insRoom.run(r.id, r.name, r.emoji, r.capacity, r.isOpen ? 1 : 0, r.scope)
  })()
}
