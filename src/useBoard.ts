import { useSyncExternalStore } from 'react'
import { getMeta, getState, subscribe } from './store'
import type { StoreMeta } from './storeTypes'
import type { BoardState } from './types'

export function useBoard(): BoardState {
  return useSyncExternalStore(subscribe, getState)
}

export function useMeta(): StoreMeta {
  return useSyncExternalStore(subscribe, getMeta)
}
