import { canBook } from './boardLogic'
import type {
  AuthResult,
  BoardStore,
  CreateAccountResult,
  ImportResult,
  PasswordResult,
  StoreMeta,
} from './storeTypes'
import type { Account, BoardState, BookResult, Role } from './types'

// Server-backed store: REST mutations + WebSocket push. Booking mutations are
// optimistic (local rule check applies instantly), the server broadcast
// corrects any race. Admin CRUD relies on the broadcast round-trip.

const EMPTY_STATE: BoardState = { klasses: [], kids: [], rooms: [] }
let state: BoardState = EMPTY_STATE
let meta: StoreMeta = {
  mode: 'api',
  ready: false,
  schoolName: window.__RAUMBOARD__?.schoolName,
  deviceUnlocked: false,
  teacherConfirmed: false,
  isAdmin: false,
  dev: false,
  ephemeral: false,
}
let teacherToken: string | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function setMeta(patch: Partial<StoreMeta>) {
  meta = { ...meta, ...patch }
  notify()
}

function becomeLocked(patch: Partial<StoreMeta> = {}) {
  state = EMPTY_STATE
  teacherToken = null
  meta = {
    ...meta, ...patch, ready: true, deviceUnlocked: false, teacherConfirmed: false,
    isAdmin: false, account: null,
  }
  disconnectSocket()
  notify()
}

async function refetch(): Promise<void> {
  try {
    const res = await fetch('/api/state')
    if (!res.ok) return
    const data = await res.json()
    if (!data.state || !data.meta.deviceUnlocked) {
      becomeLocked(data.meta)
      return
    }
    state = data.state
    meta = { ...meta, ...data.meta, ready: true }
    notify()
    connect()
  } catch {
    // offline/server restart — WS reconnect + interval will retry
  }
}

function headers(withTeacher = false): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(withTeacher && teacherToken ? { 'X-Raumboard-Teacher': teacherToken } : {}),
  }
}

async function post(path: string, body?: object, withTeacher = false): Promise<Response> {
  const res = await fetch(path, {
    method: 'POST',
    headers: headers(withTeacher),
    body: body ? JSON.stringify(body) : '{}',
  })
  if (res.status === 401) {
    // lock state changed on the server (cookie expired etc.) → resync flags
    void refetch()
  }
  if (withTeacher && res.status === 403) setMeta({ teacherConfirmed: false })
  return res
}

function mutate(path: string, body?: object, withTeacher = false): void {
  void post(path, body, withTeacher).then((res) => {
    if (!res.ok) void refetch()
  })
}

async function request(
  method: 'PATCH' | 'DELETE',
  path: string,
  body?: object,
  withTeacher = false,
): Promise<void> {
  const res = await fetch(path, {
    method,
    headers: headers(withTeacher),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) void refetch()
  if (withTeacher && res.status === 403) setMeta({ teacherConfirmed: false })
}

// --- websocket lifecycle -----------------------------------------------------

let wsRetry = 1000
let socket: WebSocket | null = null
let retryTimer: number | null = null

function disconnectSocket() {
  if (retryTimer !== null) window.clearTimeout(retryTimer)
  retryTimer = null
  if (!socket) return
  socket.onclose = null
  socket.close()
  socket = null
}

function connect() {
  if (!meta.deviceUnlocked || socket) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  socket = new WebSocket(`${proto}://${location.host}/api/ws`)
  socket.onopen = () => {
    wsRetry = 1000
  }
  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'state') {
        if (!meta.deviceUnlocked) return
        state = msg.state
        if (!meta.ready) meta = { ...meta, ready: true }
        notify()
      } else if (msg.type === 'symbols') {
        // the symbols setting is school-wide; it reaches every board without reload
        meta = { ...meta, symbols: msg.symbols }
        notify()
      } else if (msg.type === 'locked') {
        becomeLocked()
      }
    } catch {
      // ignore malformed frames
    }
  }
  socket.onclose = () => {
    socket = null
    if (!meta.deviceUnlocked) return
    retryTimer = window.setTimeout(connect, wsRetry)
    wsRetry = Math.min(wsRetry * 2, 15000)
  }
}

// A locked device never opens a socket. The first successful state fetch after
// unlocking starts it; every later reconnect is conditional on that grant.
void refetch()
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

  reset() {},

  reseed() {
    // demo boards and local dev only (guarded on the server); no-op if forbidden
    mutate('/api/reseed')
  },

  addRoom(name, emoji, capacity, scope) {
    mutate('/api/rooms', { name, emoji, capacity, scope }, true)
  },
  updateRoom(roomId, patch) {
    void request('PATCH', `/api/rooms/${encodeURIComponent(roomId)}`, patch, true)
  },
  removeRoom(roomId) {
    void request('DELETE', `/api/rooms/${encodeURIComponent(roomId)}`, undefined, true)
  },
  addKid(klassId, symbol, name) {
    mutate('/api/kids', { klassId, symbol, name }, true)
  },
  updateKid(kidId, patch) {
    void request('PATCH', `/api/kids/${encodeURIComponent(kidId)}`, patch, true)
  },
  removeKid(kidId) {
    void request('DELETE', `/api/kids/${encodeURIComponent(kidId)}`, undefined, true)
  },
  addKlass(name, emoji) {
    mutate('/api/klasses', { name, emoji }, true)
  },
  updateKlass(klassId, patch) {
    void request('PATCH', `/api/klasses/${encodeURIComponent(klassId)}`, patch, true)
  },
  removeKlass(klassId) {
    void request('DELETE', `/api/klasses/${encodeURIComponent(klassId)}`, undefined, true)
  },

  async importKids(entries, targetKlass, mode): Promise<ImportResult> {
    const res = await post('/api/admin/import', { kids: entries, targetKlass, mode }, true)
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

  async unlockDevice(pin): Promise<AuthResult> {
    const res = await post('/api/pin', { pin })
    if (res.ok) {
      await refetch()
      return { ok: true }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'PIN falsch' }
  },

  async confirmTeacherPin(pin): Promise<AuthResult> {
    const res = await post('/api/teacher/verify', { pin })
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data.token === 'string') {
      teacherToken = data.token
      setMeta({ teacherConfirmed: true })
      return { ok: true }
    }
    return { ok: false, reason: data.error ?? 'PIN falsch' }
  },

  clearTeacherAccess() {
    teacherToken = null
    setMeta({ teacherConfirmed: false })
  },

  async resetWithPin(pin): Promise<AuthResult> {
    const res = await post('/api/reset', { pin })
    if (res.ok) {
      await refetch()
      return { ok: true }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'PIN falsch' }
  },

  async verifyPassword(password): Promise<AuthResult> {
    const res = await post('/api/verify-password', { password }, true)
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Passwort falsch' }
  },

  async changePassword(current, next): Promise<AuthResult> {
    const res = await post('/api/change-password', { current, next }, true)
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Ändern fehlgeschlagen' }
  },

  async changePin(password, pin): Promise<AuthResult> {
    const res = await post('/api/change-pin', { password, pin }, true)
    if (res.ok) {
      becomeLocked({ pinLength: pin.trim().length })
      return { ok: true }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Ändern fehlgeschlagen' }
  },

  async setSymbols(mode): Promise<AuthResult> {
    const res = await post('/api/symbols', { symbols: mode }, true)
    if (res.ok) {
      setMeta({ symbols: mode })
      return { ok: true }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Speichern fehlgeschlagen' }
  },

  async lockDevice() {
    await post('/api/lock')
    becomeLocked()
  },

  async listAccounts(): Promise<Account[]> {
    const res = await fetch('/api/accounts', { headers: headers(true) })
    if (res.status === 401) void refetch()
    if (res.status === 403) setMeta({ teacherConfirmed: false })
    if (!res.ok) return []
    const data = await res.json().catch(() => ({}))
    return (data.accounts ?? []) as Account[]
  },

  async createAccount(email, role: Role): Promise<CreateAccountResult> {
    const res = await post('/api/accounts', { email, role }, true)
    const data = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, account: data.account as Account, password: data.password as string }
    return { ok: false, reason: data.error ?? 'Anlegen fehlgeschlagen' }
  },

  async updateAccount(id, patch): Promise<AuthResult> {
    const res = await fetch(`/api/accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: headers(true),
      body: JSON.stringify(patch),
    })
    if (res.status === 401) void refetch()
    if (res.status === 403) setMeta({ teacherConfirmed: false })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, reason: data.error ?? 'Ändern fehlgeschlagen' }
  },

  async resetAccountPassword(id): Promise<PasswordResult> {
    const res = await post(`/api/accounts/${encodeURIComponent(id)}/reset-password`, undefined, true)
    const data = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, password: data.password as string }
    return { ok: false, reason: data.error ?? 'Zurücksetzen fehlgeschlagen' }
  },
}
