export type Klass = {
  id: string
  name: string // "1A" … "4B"
}

export type Kid = {
  id: string
  klassId: string
  symbol: string // emoji tile symbol
  name: string // dummy names only, never real kids (see AGENTS.md)
  currentRoomId: string | null // null = own classroom
}

export type Room = {
  id: string
  name: string
  emoji: string
  capacity: number
  isOpen: boolean
  scope: 'all' | string // klassId for class-bound rooms (hallway desks)
}

export type BoardState = {
  klasses: Klass[]
  kids: Kid[]
  rooms: Room[]
}

export type BookResult = { ok: true } | { ok: false; reason: string }
