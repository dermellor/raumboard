import type { CSSProperties } from 'react'
import type { Room } from './types'

// Room accent colors are derived (not stored) so existing localStorage states
// need no migration. Known rooms get their semantic color, everything else a
// stable palette pick based on the id.

export type RoomColor = { accent: string; tint: string }

const PALETTE: RoomColor[] = [
  { accent: '#0EA5E9', tint: '#E0F2FE' }, // sky
  { accent: '#F59E0B', tint: '#FEF3C7' }, // amber
  { accent: '#8B5CF6', tint: '#EDE9FE' }, // violet
  { accent: '#EC4899', tint: '#FCE7F3' }, // pink
  { accent: '#14B8A6', tint: '#CCFBF1' }, // teal
  { accent: '#84CC16', tint: '#ECFCCB' }, // lime
]

const KNOWN: Record<string, RoomColor> = {
  'atelier-blau': { accent: '#2563EB', tint: '#DBEAFE' },
  'atelier-rot': { accent: '#DC2626', tint: '#FEE2E2' },
  'atelier-gruen': { accent: '#16A34A', tint: '#DCFCE7' },
  bibliothek: { accent: '#D97706', tint: '#FEF3C7' },
  foyer: { accent: '#7C3AED', tint: '#EDE9FE' },
  garten: { accent: '#0D9488', tint: '#CCFBF1' },
}

export const HOME_COLOR: RoomColor = { accent: '#EA580C', tint: '#FFEDD5' }
const FLUR_COLOR: RoomColor = { accent: '#64748B', tint: '#E2E8F0' }

export function roomVars(room: Room): CSSProperties {
  const c = roomColor(room)
  return { '--accent': c.accent, '--tint': c.tint } as CSSProperties
}

export function roomColor(room: Room): RoomColor {
  if (KNOWN[room.id]) return KNOWN[room.id]
  if (room.scope !== 'all') return FLUR_COLOR
  let hash = 0
  for (const ch of room.id) hash = (hash * 31 + ch.charCodeAt(0)) % 997
  return PALETTE[hash % PALETTE.length]
}
