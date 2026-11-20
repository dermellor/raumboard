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

// The switch: served by the Raumboard server, the dev proxy or a Cockpit
// preview (which proxies /api to the running backend) → api store, otherwise
// (static prototype/demo) → localStorage store.
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
  lockDevice,
  listAccounts,
  createAccount,
  updateAccount,
  resetAccountPassword,
} = store
