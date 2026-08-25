import type { BoardState, BookResult, Kid, Klass, Room } from './types'

export type StoreMeta = {
  mode: 'demo' | 'api'
  /** false until the first state fetch (api mode); demo is always ready */
  ready: boolean
  schoolName?: string
  /** teacher level: bookings and the Verwaltung (teacher PIN entered, or admin) */
  canOperate: boolean
  /** account level: the Excel/CSV import, nothing else */
  isAdmin: boolean
  /** server runs in local dev mode (RAUMBOARD_DEV) — enables test-only affordances */
  dev: boolean
  /**
   * This board is the public demo: the server holds it in RAM for this visitor
   * only and stores nothing, so anyone may put it back to the seed data.
   */
  ephemeral: boolean
  /**
   * The demo's published login and PIN, so its forms can prefill themselves.
   * Null on a school's board.
   */
  demoCredentials?: { email: string; password: string; pin: string } | null
  /** digit count of the teacher PIN (api mode), for the segmented gate display */
  pinLength?: number | null
}

export type AuthResult = { ok: true } | { ok: false; reason: string }

export type ImportEntry = { name: string; symbol: string; klass: string | null }
export type ImportResult =
  | { ok: true; added: number; klassesCreated: string[] }
  | { ok: false; reason: string }

/**
 * Contract shared by demoStore (localStorage) and apiStore (server).
 * Mutations are synchronous fire-and-forget from the views' perspective;
 * `book` returns the local rule check, server corrections arrive via
 * subscribe (WS broadcast / refetch).
 */
export type BoardStore = {
  getState(): BoardState
  getMeta(): StoreMeta
  subscribe(listener: () => void): () => void

  book(kidId: string, roomId: string): BookResult
  unbook(kidId: string): void
  reset(): void
  /** demo mode only */
  reseed(): void

  addRoom(name: string, emoji: string, capacity: number, scope: Room['scope']): void
  updateRoom(roomId: string, patch: Partial<Omit<Room, 'id'>>): void
  removeRoom(roomId: string): void
  addKid(klassId: string, symbol: string, name: string): void
  updateKid(kidId: string, patch: Partial<Pick<Kid, 'name' | 'symbol' | 'klassId'>>): void
  removeKid(kidId: string): void
  addKlass(name: string, emoji?: string): void
  updateKlass(klassId: string, patch: Partial<Pick<Klass, 'name' | 'emoji'>>): void
  removeKlass(klassId: string): void

  importKids(
    entries: ImportEntry[],
    targetKlass: string | null,
    mode: 'append' | 'replace',
  ): Promise<ImportResult>

  login(email: string, password: string): Promise<AuthResult>
  /** ends the admin session; the device stays unlocked for booking */
  logout(): Promise<void>
  enterPin(pin: string): Promise<AuthResult>
  /** clears admin + board unlock, so the PIN gate is asked for again */
  lockDevice(): Promise<void>
  /** is this the school's password? changes nothing (gate in front of two tabs) */
  verifyPassword(password: string): Promise<AuthResult>
  /** re-verify with the current password (api mode; demo has nothing to change) */
  changePassword(current: string, next: string): Promise<AuthResult>
  changePin(password: string, pin: string): Promise<AuthResult>
}
