import type { BoardState, BookResult, Kid, Room } from './types'

// Pure booking rules — shared between the frontend stores and the server
// (server/board.ts). Keep this module free of browser/node APIs.

export function occupancy(roomId: string, s: BoardState): number {
  return s.kids.filter((k) => k.currentRoomId === roomId).length
}

export function freeSlots(room: Room, s: BoardState): number {
  return room.capacity - occupancy(room.id, s)
}

export function canBook(kid: Kid, room: Room, s: BoardState): BookResult {
  if (!room.isOpen) return { ok: false, reason: 'Raum ist geschlossen' }
  if (room.scope !== 'all' && room.scope !== kid.klassId)
    return { ok: false, reason: 'Raum gehört einer anderen Klasse' }
  if (kid.currentRoomId !== room.id && freeSlots(room, s) <= 0)
    return { ok: false, reason: 'Raum ist voll' }
  return { ok: true }
}
