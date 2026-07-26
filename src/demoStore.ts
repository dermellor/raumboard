import { canBook } from './boardLogic'
import { buildSeed } from './seed'
import type { BoardStore, StoreMeta } from './storeTypes'
import type { BoardState, BookResult, Kid, Klass, Room } from './types'

// Demo/offline store: localStorage persistence + cross-tab sync via the
// `storage` event. Used on the static prototype and as showcase mode.

const STORAGE_KEY = 'lernraum-board-v1'

const META: StoreMeta = { mode: 'demo', ready: true, canBook: true, isAdmin: true }

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

export const demoStore: BoardStore = {
  getState: () => state,
  getMeta: () => META,
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  book(kidId, roomId): BookResult {
    const kid = state.kids.find((k) => k.id === kidId)
    const room = state.rooms.find((r) => r.id === roomId)
    if (!kid || !room) return { ok: false, reason: 'Kind oder Raum nicht gefunden' }
    const check = canBook(kid, room, state)
    if (!check.ok) return check
    commit({
      ...state,
      kids: state.kids.map((k) => (k.id === kidId ? { ...k, currentRoomId: roomId } : k)),
    })
    return { ok: true }
  },

  unbook(kidId) {
    commit({
      ...state,
      kids: state.kids.map((k) => (k.id === kidId ? { ...k, currentRoomId: null } : k)),
    })
  },

  /** "Feierabend-Reset": everyone back to their own classroom. */
  reset() {
    commit({ ...state, kids: state.kids.map((k) => ({ ...k, currentRoomId: null })) })
  },

  reseed() {
    commit(buildSeed())
  },

  addRoom(name, emoji, capacity, scope) {
    const room: Room = { id: slug(name), name, emoji, capacity, isOpen: true, scope }
    commit({ ...state, rooms: [...state.rooms, room] })
  },

  updateRoom(roomId, patch) {
    // Shrinking capacity or closing never evicts kids: existing bookings stay,
    // only new bookings are blocked. Teachers rebook manually if needed.
    commit({
      ...state,
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)),
    })
  },

  removeRoom(roomId) {
    commit({
      ...state,
      rooms: state.rooms.filter((r) => r.id !== roomId),
      kids: state.kids.map((k) => (k.currentRoomId === roomId ? { ...k, currentRoomId: null } : k)),
    })
  },

  addKid(klassId, symbol, name) {
    const kid: Kid = { id: slug(`${klassId}-${name}`), klassId, symbol, name, currentRoomId: null }
    commit({ ...state, kids: [...state.kids, kid] })
  },

  updateKid(kidId, patch) {
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
  },

  removeKid(kidId) {
    commit({ ...state, kids: state.kids.filter((k) => k.id !== kidId) })
  },

  addKlass(name, emoji) {
    const klass: Klass = { id: slug(name), name, emoji }
    commit({ ...state, klasses: [...state.klasses, klass] })
  },

  updateKlass(klassId, patch) {
    commit({
      ...state,
      klasses: state.klasses.map((c) => (c.id === klassId ? { ...c, ...patch } : c)),
    })
  },

  removeKlass(klassId) {
    commit({
      ...state,
      klasses: state.klasses.filter((c) => c.id !== klassId),
      kids: state.kids.filter((k) => k.klassId !== klassId),
      rooms: state.rooms.filter((r) => r.scope !== klassId),
    })
  },

  // auth is a no-op in demo mode — everything is unlocked
  async login() {
    return { ok: true as const }
  },
  async logout() {},
  async enterPin() {
    return { ok: true as const }
  },
  async changePassword() {
    return { ok: false as const, reason: 'Im Demo-Modus nicht verfügbar' }
  },
  async changePin() {
    return { ok: false as const, reason: 'Im Demo-Modus nicht verfügbar' }
  },
}
