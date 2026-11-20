import type { StoreMeta } from './storeTypes'

/** A room may only be deleted while an active school account is signed in. */
export function canDeleteRooms(meta: Pick<StoreMeta, 'isAdmin' | 'account'>): boolean {
  return meta.isAdmin && (meta.account?.role === 'admin' || meta.account?.role === 'owner')
}
