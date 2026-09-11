import type { CSSProperties } from 'react'
import type { Room } from './types'
import { hexname } from './emoji-hex'
import { EMOJI_COLORS, type EmojiColor } from './emoji-assets'

// Room colors are derived from the room's symbol, never stored and never keyed
// by room id: whatever a school names its rooms, a tile carries the color of
// its emoji. The pairs are generated from the dominant fill of the OpenMoji
// SVGs (scripts/fetch-openmoji.mjs → EMOJI_COLORS), so the OpenMoji artwork is
// the single source of the palette. An emoji without an asset falls back to a
// neutral pair, and class-bound rooms (hallway desks) stay gray to read as
// "restricted", not as a learning place.

export type RoomColor = EmojiColor

const FLUR_COLOR: RoomColor = { accent: '#64748B', tint: '#E2E8F0' }
const FALLBACK_COLOR: RoomColor = { accent: '#64748B', tint: '#F1F5F9' }

// The "own classroom" pseudo-room has no emoji of its own and keeps its fixed
// color, so no board shifts hue underneath a class mid-year.
export const HOME_COLOR: RoomColor = { accent: '#EA580C', tint: '#FFEDD5' }

/** CSS vars for the "own classroom" pseudo-room. */
export const homeVars = { '--accent': HOME_COLOR.accent, '--tint': HOME_COLOR.tint } as CSSProperties

export function roomVars(room: Room): CSSProperties {
  const c = roomColor(room)
  return { '--accent': c.accent, '--tint': c.tint } as CSSProperties
}

export function roomColor(room: Room): RoomColor {
  if (room.scope !== 'all') return FLUR_COLOR
  return (room.emoji && EMOJI_COLORS[hexname(room.emoji)]) || FALLBACK_COLOR
}
