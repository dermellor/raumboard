import { useSyncExternalStore } from 'react'
import { getState, subscribe } from './store'
import type { BoardState } from './types'

export function useBoard(): BoardState {
  return useSyncExternalStore(subscribe, getState)
}
