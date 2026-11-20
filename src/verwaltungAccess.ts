import type { StoreMeta } from './storeTypes'

/**
 * Entering the Verwaltung always needs an in-memory teacher confirmation in
 * API mode. An operator dev-open link may unlock the device, but must not hide
 * this gate in previews or production-like sessions.
 */
export function needsTeacherPin(meta: Pick<StoreMeta, 'mode' | 'teacherConfirmed'>): boolean {
  return meta.mode === 'api' && !meta.teacherConfirmed
}
