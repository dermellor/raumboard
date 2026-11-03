import type { NowPoint } from './boardLogic'

/**
 * "Now" on the weekly grid, in the school's timezone. All raumboard schools are
 * in Germany, so boards and server both evaluate windows in Europe/Berlin —
 * a whiteboard with a wrong device timezone must not hide today's AGs.
 * Works in the browser and in Node (Intl only), pin-able in tests by passing a date.
 */
export function nowPoint(date: Date = new Date()): NowPoint {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const name = get('weekday').replace(/\./g, '')
  const day = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 7 }[name] ?? 1
  const hour = Number(get('hour')) % 24 // formats may yield "24" for midnight
  return { day, minutes: hour * 60 + Number(get('minute')) }
}
