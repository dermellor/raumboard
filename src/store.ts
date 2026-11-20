import { apiStore } from './apiStore'
import { demoStore } from './demoStore'
import type { BoardStore } from './storeTypes'
import { shouldUseApiStore } from './runtimeMode'

export { canBook, freeSlots, occupancy } from './boardLogic'
export type { AuthResult, StoreMeta } from './storeTypes'

declare global {
  interface Window {
    /** injected by the server into index.html for tenant pages */
    __RAUMBOARD__?: { schoolName: string }
  }
}

// Der Schalter: bedient vom Raumboard-Server, dem Dev-Proxy oder einer Cockpit-
// Vorschau (die /api an das laufende Backend proxyt) → api store, sonst
// (statischer Prototyp/Demo) → localStorage store.
const useApi = shouldUseApiStore(
  Boolean(window.__RAUMBOARD__),
  import.meta.env.VITE_API,
  window.location.pathname,
)

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
  unlockDevice,
  confirmTeacherPin,
  clearTeacherAccess,
  resetWithPin,
  verifyPassword,
  changePassword,
  changePin,
  setSymbols,
  setRoomsHeading,
  lockDevice,
  listAccounts,
  createAccount,
  updateAccount,
  resetAccountPassword,
} = store
