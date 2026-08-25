import { apiStore } from './apiStore'
import { demoStore } from './demoStore'
import type { BoardStore } from './storeTypes'

export { canBook, freeSlots, occupancy } from './boardLogic'
export type { AuthResult, StoreMeta } from './storeTypes'

declare global {
  interface Window {
    /** injected by the server into index.html for tenant pages */
    __RAUMBOARD__?: { schoolName: string }
  }
}

// The switch: served by the Raumboard server (or dev proxy mode) → api store,
// otherwise (static prototype/demo) → localStorage store.
const useApi = Boolean(window.__RAUMBOARD__) || import.meta.env.VITE_API === 'true'

export const store: BoardStore = useApi ? apiStore : demoStore

export const {
  getState,
  getMeta,
  subscribe,
  book,
  unbook,
  reset,
  reseed,
  addRoom,
  updateRoom,
  removeRoom,
  addKid,
  updateKid,
  removeKid,
  addKlass,
  updateKlass,
  removeKlass,
  importKids,
  login,
  logout,
  enterPin,
  verifyPassword,
  changePassword,
  changePin,
  lockDevice,
} = store
