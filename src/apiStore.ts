import { canBook } from './boardLogic'
import type { AuthResult, BoardStore, StoreMeta } from './storeTypes'
import type { BoardState, BookResult } from './types'

// Server-backed store: REST mutations + WebSocket push. Booking mutations are
// optimistic (local rule check applies instantly), the server broadcast
// corrects any race. Admin CRUD relies on the broadcast round-trip.

let state: BoardState = { klasses: [], kids: [], rooms: [] }
let meta: StoreMeta = { mode: 'api', ready: false, canBook: false, isAdmin: false, dev: false }
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

void refetch()
connect()
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
    // not available against the server
  },

  addRoom(name, emoji, capacity, scope) {
    mutate('/api/admin/rooms', { name, emoji, capacity, scope })
  },
  updateRoom(roomId, patch) {
    void request('PATCH', `/api/admin/rooms/${encodeURIComponent(roomId)}`, patch)
  },
  removeRoom(roomId) {
    void request('DELETE', `/api/admin/rooms/${encodeURIComponent(roomId)}`)
  },
  addKid(klassId, symbol, name) {
    mutate('/api/admin/kids', { klassId, symbol, name })
  },
  updateKid(kidId, patch) {
    void request('PATCH', `/api/admin/kids/${encodeURIComponent(kidId)}`, patch)
  },
  removeKid(kidId) {
    void request('DELETE', `/api/admin/kids/${encodeURIComponent(kidId)}`)
  },
  addKlass(name, emoji) {
    mutate('/api/admin/klasses', { name, emoji })
  },
  updateKlass(klassId, patch) {
    void request('PATCH', `/api/admin/klasses/${encodeURIComponent(klassId)}`, patch)
  },
  removeKlass(klassId) {
    void request('DELETE', `/api/admin/klasses/${encodeURIComponent(klassId)}`)
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

  async logout() {
    await post('/api/logout')
    setMeta({ isAdmin: false, canBook: false })
    await refetch()
  },

  async enterPin(pin): Promise<AuthResult> {
    const res = await post('/api/pin', { pin })
    if (res.ok) {
      setMeta({ canBook: true })
      return { ok: true }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'PIN falsch' }
  },

  async changePassword(current, next): Promise<AuthResult> {
    const res = await post('/api/admin/change-password', { current, next })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Ändern fehlgeschlagen' }
  },

  async changePin(password, pin): Promise<AuthResult> {
    const res = await post('/api/admin/change-pin', { password, pin })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Ändern fehlgeschlagen' }
  },

  async lockDevice() {
    await post('/api/logout')
    setMeta({ isAdmin: false, canBook: false })
    await refetch()
  },
}
