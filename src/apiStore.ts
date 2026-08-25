import { canBook } from './boardLogic'
import type { AuthResult, BoardStore, ImportResult, StoreMeta } from './storeTypes'
import type { BoardState, BookResult } from './types'

// Server-backed store: REST mutations + WebSocket push. Booking mutations are
// optimistic (local rule check applies instantly), the server broadcast
// corrects any race. Admin CRUD relies on the broadcast round-trip.

let state: BoardState = { klasses: [], kids: [], rooms: [] }
let meta: StoreMeta = { mode: 'api', ready: false, canOperate: false, isAdmin: false, dev: false, ephemeral: false }
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function setMeta(patch: Partial<StoreMeta>) {
  meta = { ...meta, ...patch }
  notify()
}

async function refetch(): Promise<void> {
  try {
    const res = await fetch('/api/state')
    if (!res.ok) return
    const data = await res.json()
    state = data.state
    meta = { ...meta, ...data.meta, ready: true }
    notify()
  } catch {
    // offline/server restart — WS reconnect + interval will retry
  }
}

async function post(path: string, body?: object): Promise<Response> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  })
  if (res.status === 401) {
    // lock state changed on the server (cookie expired etc.) → resync flags
    void refetch()
  }
  return res
}

function mutate(path: string, body?: object): void {
  void post(path, body).then((res) => {
    if (!res.ok) void refetch()
  })
}

async function request(method: 'PATCH' | 'DELETE', path: string, body?: object): Promise<void> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) void refetch()
}

// --- websocket lifecycle -----------------------------------------------------

let wsRetry = 1000

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/api/ws`)
  ws.onopen = () => {
    wsRetry = 1000
  }
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'state') {
        state = msg.state
        if (!meta.ready) meta = { ...meta, ready: true }
        notify()
      }
    } catch {
      // ignore malformed frames
    }
  }
  ws.onclose = () => {
    setTimeout(connect, wsRetry)
    wsRetry = Math.min(wsRetry * 2, 15000)
  }
}

// The first fetch comes before the socket on purpose: on the public demo it is
// what mints the session cookie, and the upgrade needs that cookie to know which
// board it is for. `finally` so an offline start still ends up in the retry loop.
void refetch().finally(connect)
// safety net: WS can silently miss frames across proxies/standby — resync
setInterval(() => void refetch(), 60_000)

// --- store implementation ------------------------------------------------------

export const apiStore: BoardStore = {
  getState: () => state,
  getMeta: () => meta,
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
    // optimistic: instant feedback on the whiteboard, server broadcast corrects races
    state = {
      ...state,
      kids: state.kids.map((k) => (k.id === kidId ? { ...k, currentRoomId: roomId } : k)),
    }
    notify()
    mutate('/api/book', { kidId, roomId })
    return { ok: true }
  },

  unbook(kidId) {
    state = {
      ...state,
      kids: state.kids.map((k) => (k.id === kidId ? { ...k, currentRoomId: null } : k)),
    }
    notify()
    mutate('/api/unbook', { kidId })
  },

  reset() {
    mutate('/api/reset')
  },

  reseed() {
    // demo boards and local dev only (guarded on the server); no-op if forbidden
    mutate('/api/reseed')
  },

  addRoom(name, emoji, capacity, scope) {
    mutate('/api/rooms', { name, emoji, capacity, scope })
  },
  updateRoom(roomId, patch) {
    void request('PATCH', `/api/rooms/${encodeURIComponent(roomId)}`, patch)
  },
  removeRoom(roomId) {
    void request('DELETE', `/api/rooms/${encodeURIComponent(roomId)}`)
  },
  addKid(klassId, symbol, name) {
    mutate('/api/kids', { klassId, symbol, name })
  },
  updateKid(kidId, patch) {
    void request('PATCH', `/api/kids/${encodeURIComponent(kidId)}`, patch)
  },
  removeKid(kidId) {
    void request('DELETE', `/api/kids/${encodeURIComponent(kidId)}`)
  },
  addKlass(name, emoji) {
    mutate('/api/klasses', { name, emoji })
  },
  updateKlass(klassId, patch) {
    void request('PATCH', `/api/klasses/${encodeURIComponent(klassId)}`, patch)
  },
  removeKlass(klassId) {
    void request('DELETE', `/api/klasses/${encodeURIComponent(klassId)}`)
  },

  async importKids(entries, targetKlass, mode): Promise<ImportResult> {
    const res = await post('/api/admin/import', { kids: entries, targetKlass, mode })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      await refetch()
      return { ok: true, added: data.added ?? entries.length, klassesCreated: data.klassesCreated ?? [] }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Import fehlgeschlagen' }
  },

  async login(email, password): Promise<AuthResult> {
    const res = await post('/api/login', { email, password })
    if (res.ok) {
      await refetch()
      return { ok: true }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Login fehlgeschlagen' }
  },

  /** Admin session only: the device keeps its unlock and stays bookable. */
  async logout() {
    await post('/api/logout')
    setMeta({ isAdmin: false })
    await refetch()
  },

  async enterPin(pin): Promise<AuthResult> {
    const res = await post('/api/pin', { pin })
    if (res.ok) {
      setMeta({ canOperate: true })
      return { ok: true }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'PIN falsch' }
  },

  async verifyPassword(password): Promise<AuthResult> {
    const res = await post('/api/verify-password', { password })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Passwort falsch' }
  },

  async changePassword(current, next): Promise<AuthResult> {
    const res = await post('/api/change-password', { current, next })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Ändern fehlgeschlagen' }
  },

  async changePin(password, pin): Promise<AuthResult> {
    const res = await post('/api/change-pin', { password, pin })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Ändern fehlgeschlagen' }
  },

  async lockDevice() {
    await post('/api/lock')
    setMeta({ isAdmin: false, canOperate: false })
    await refetch()
  },
}
