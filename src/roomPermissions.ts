import type { StoreMeta } from './storeTypes'

/**
 * A room may only be deleted while an active school account (role admin or
 * owner) is signed in. Editing is a step lighter: it follows `meta.isAdmin`
 * (a signed-in admin session, see the pencil in RaeumePage).
 */
export function canManageRooms(meta: Pick<StoreMeta, 'isAdmin' | 'account'>): boolean {
  return meta.isAdmin && (meta.account?.role === 'admin' || meta.account?.role === 'owner')
}

/** Legacy name of the permission above, kept for the delete call sites. */
export const canDeleteRooms = canManageRooms
