import type { BoardState, BookResult, Kid, Klass, Room } from './types'

export type StoreMeta = {
  mode: 'demo' | 'api'
  /** false until the first state fetch (api mode); demo is always ready */
  ready: boolean
  schoolName?: string
  /** booking mutations allowed (teacher PIN entered or admin) */
  canBook: boolean
  isAdmin: boolean
  /** server runs in local dev mode (RAUMBOARD_DEV) — enables test-only affordances */
  dev: boolean
}

export type AuthResult = { ok: true } | { ok: false; reason: string }

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

  login(email: string, password: string): Promise<AuthResult>
  logout(): Promise<void>
  enterPin(pin: string): Promise<AuthResult>
  /** dev/test only: clear admin + board unlock so the PIN gate reappears */
  lockDevice(): Promise<void>
  /** re-verify with the current password (api mode; demo has nothing to change) */
  changePassword(current: string, next: string): Promise<AuthResult>
  changePin(password: string, pin: string): Promise<AuthResult>
}
