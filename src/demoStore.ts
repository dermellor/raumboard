import { canBook } from './boardLogic'
import { buildSeed } from './seed'
import type { BoardStore, ImportResult, StoreMeta } from './storeTypes'
import type { BoardState, BookResult, Kid, Klass, Room } from './types'

// Demo/offline store: localStorage persistence + cross-tab sync via the
// `storage` event. Used on the static prototype and as showcase mode.

const STORAGE_KEY = 'lernraum-board-v1'

const META: StoreMeta = { mode: 'demo', ready: true, canOperate: true, isAdmin: true, dev: false, ephemeral: false }

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
        // Moving to another class: a booking in a room the new class may not
        // use is no longer legal → back to the classroom.
        if (patch.klassId && patch.klassId !== k.klassId && k.currentRoomId) {
          const room = state.rooms.find((r) => r.id === k.currentRoomId)
          if (room && room.scope !== 'all' && !room.scope.includes(patch.klassId)) next.currentRoomId = null
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
    // Rooms keep the other classes in their scope; one that ends up with an
    // empty scope goes with the class, and kids booked there return home.
    const dropped = new Set(
      state.rooms
        .filter((r) => r.scope !== 'all' && r.scope.length === 1 && r.scope[0] === klassId)
        .map((r) => r.id),
    )
    commit({
      ...state,
      klasses: state.klasses.filter((c) => c.id !== klassId),
      kids: state.kids
        .filter((k) => k.klassId !== klassId)
        .map((k) => (k.currentRoomId && dropped.has(k.currentRoomId) ? { ...k, currentRoomId: null } : k)),
      rooms: state.rooms
        .filter((r) => !dropped.has(r.id))
        .map((r) => (r.scope === 'all' ? r : { ...r, scope: r.scope.filter((id) => id !== klassId) })),
    })
  },

  async importKids(entries, targetKlass, mode): Promise<ImportResult> {
    const klasses: Klass[] = [...state.klasses]
    let kids: Kid[] = [...state.kids]
    const klassesCreated: string[] = []
    const idByName = new Map(klasses.map((c) => [c.name.toLowerCase(), c.id]))

    const resolveKlass = (name: string): string => {
      const key = name.trim().toLowerCase()
      const existing = idByName.get(key)
      if (existing) return existing
      const id = slug(name.trim())
      klasses.push({ id, name: name.trim() })
      idByName.set(key, id)
      klassesCreated.push(name.trim())
      return id
    }

    const prepared = entries
      .map((e) => ({ ...e, klassName: (e.klass || targetKlass || '').trim() }))
      .filter((e) => e.name.trim() && e.klassName)

    if (mode === 'replace') {
      const targetIds = new Set(prepared.map((e) => resolveKlass(e.klassName)))
      kids = kids.filter((k) => !targetIds.has(k.klassId))
    }

    let added = 0
    for (const e of prepared) {
      const klassId = resolveKlass(e.klassName)
      const taken = new Set([...state.rooms, ...kids, ...klasses].map((x) => x.id))
      let id = slug(`${klassId}-${e.name.trim()}`)
      let n = 2
      while (taken.has(id)) id = `${slug(`${klassId}-${e.name.trim()}`)}-${n++}`
      kids.push({ id, klassId, symbol: e.symbol || '⭐', name: e.name.trim(), currentRoomId: null })
      added++
    }

    commit({ ...state, klasses, kids })
    return { ok: true, added, klassesCreated }
  },

  // auth is a no-op in demo mode — everything is unlocked
  async login() {
    return { ok: true as const }
  },
  async logout() {},
  async enterPin() {
    return { ok: true as const }
  },
  async verifyPassword() {
    return { ok: true as const }
  },
  async changePassword() {
    return { ok: false as const, reason: 'Im Demo-Modus nicht verfügbar' }
  },
  async changePin() {
    return { ok: false as const, reason: 'Im Demo-Modus nicht verfügbar' }
  },
  async lockDevice() {},

  // no accounts in the offline demo store — the „Konten" tab is api-mode only
  async listAccounts() {
    return []
  },
  async createAccount() {
    return { ok: false as const, reason: 'Im Demo-Modus nicht verfügbar' }
  },
  async updateAccount() {
    return { ok: false as const, reason: 'Im Demo-Modus nicht verfügbar' }
  },
  async resetAccountPassword() {
    return { ok: false as const, reason: 'Im Demo-Modus nicht verfügbar' }
  },
}
