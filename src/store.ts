import { buildSeed } from './seed'
import type { BoardState, BookResult, Kid, Klass, Room } from './types'

// Phase-1 store: in-memory state + localStorage persistence + cross-tab sync
// via the `storage` event. The exported functions are the contract for the
// Phase-2 API — swap the implementation, keep the interface.

const STORAGE_KEY = 'lernraum-board-v1'

let state: BoardState = load()
const listeners = new Set<() => void>()

function load(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as BoardState
  } catch {
    // corrupt storage → fall through to seed
  }
  return buildSeed()
}

function commit(next: BoardState) {
  state = next
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  listeners.forEach((l) => l())
}

// Another tab wrote a new state → adopt it and re-render.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || e.newValue == null) return
  try {
    state = JSON.parse(e.newValue) as BoardState
    listeners.forEach((l) => l())
  } catch {
    // ignore malformed foreign writes
  }
})

export function getState(): BoardState {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// --- derived helpers ---------------------------------------------------

export function occupancy(roomId: string, s: BoardState = state): number {
  return s.kids.filter((k) => k.currentRoomId === roomId).length
}

export function freeSlots(room: Room, s: BoardState = state): number {
  return room.capacity - occupancy(room.id, s)
}

export function canBook(kid: Kid, room: Room, s: BoardState = state): BookResult {
  if (!room.isOpen) return { ok: false, reason: 'Raum ist geschlossen' }
  if (room.scope !== 'all' && room.scope !== kid.klassId)
    return { ok: false, reason: 'Raum gehört einer anderen Klasse' }
  if (kid.currentRoomId !== room.id && freeSlots(room, s) <= 0)
    return { ok: false, reason: 'Raum ist voll' }
  return { ok: true }
}

// --- booking mutations --------------------------------------------------

export function book(kidId: string, roomId: string): BookResult {
  const kid = state.kids.find((k) => k.id === kidId)
  const room = state.rooms.find((r) => r.id === roomId)
  if (!kid || !room) return { ok: false, reason: 'Kind oder Raum nicht gefunden' }
  const check = canBook(kid, room)
  if (!check.ok) return check
  commit({
    ...state,
    kids: state.kids.map((k) => (k.id === kidId ? { ...k, currentRoomId: roomId } : k)),
  })
  return { ok: true }
}

export function unbook(kidId: string): void {
  commit({
    ...state,
    kids: state.kids.map((k) => (k.id === kidId ? { ...k, currentRoomId: null } : k)),
  })
}

/** "Feierabend-Reset": everyone back to their own classroom. */
export function reset(): void {
  commit({ ...state, kids: state.kids.map((k) => ({ ...k, currentRoomId: null })) })
}

export function reseed(): void {
  commit(buildSeed())
}

// --- admin mutations ----------------------------------------------------

function slug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  let id = base || 'x'
  let n = 2
  const taken = new Set([...state.rooms, ...state.kids, ...state.klasses].map((x) => x.id))
  while (taken.has(id)) id = `${base}-${n++}`
  return id
}

export function addRoom(name: string, emoji: string, capacity: number, scope: Room['scope']): void {
  const room: Room = { id: slug(name), name, emoji, capacity, isOpen: true, scope }
  commit({ ...state, rooms: [...state.rooms, room] })
}

export function updateRoom(roomId: string, patch: Partial<Omit<Room, 'id'>>): void {
  const next = {
    ...state,
    rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)),
  }
  // Shrinking capacity or closing never evicts kids: existing bookings stay,
  // only new bookings are blocked. Teachers rebook manually if needed.
  commit(next)
}

export function removeRoom(roomId: string): void {
  commit({
    ...state,
    rooms: state.rooms.filter((r) => r.id !== roomId),
    kids: state.kids.map((k) => (k.currentRoomId === roomId ? { ...k, currentRoomId: null } : k)),
  })
}

export function addKid(klassId: string, symbol: string, name: string): void {
  const kid: Kid = { id: slug(`${klassId}-${name}`), klassId, symbol, name, currentRoomId: null }
  commit({ ...state, kids: [...state.kids, kid] })
}

export function updateKid(kidId: string, patch: Partial<Pick<Kid, 'name' | 'symbol' | 'klassId'>>): void {
  commit({
    ...state,
    kids: state.kids.map((k) => {
      if (k.id !== kidId) return k
      const next = { ...k, ...patch }
      // Moving to another class: a booking in the old class's hallway room
      // is no longer legal → back to the classroom.
      if (patch.klassId && patch.klassId !== k.klassId && k.currentRoomId) {
        const room = state.rooms.find((r) => r.id === k.currentRoomId)
        if (room && room.scope !== 'all' && room.scope !== patch.klassId) next.currentRoomId = null
      }
      return next
    }),
  })
}

export function removeKid(kidId: string): void {
  commit({ ...state, kids: state.kids.filter((k) => k.id !== kidId) })
}

export function addKlass(name: string, emoji?: string): void {
  commit({ ...state, klasses: [...state.klasses, { id: slug(name), name, emoji }] })
}

export function updateKlass(klassId: string, patch: Partial<Pick<Klass, 'name' | 'emoji'>>): void {
  commit({
    ...state,
    klasses: state.klasses.map((c) => (c.id === klassId ? { ...c, ...patch } : c)),
  })
}

export function removeKlass(klassId: string): void {
  commit({
    ...state,
    klasses: state.klasses.filter((c) => c.id !== klassId),
    kids: state.kids.filter((k) => k.klassId !== klassId),
    rooms: state.rooms.filter((r) => r.scope !== klassId),
  })
}
