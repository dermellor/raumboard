import { useSyncExternalStore } from 'react'

/** One page of the Verwaltung namespace, `#/verwaltung/<page>`. */
export type VerwaltungPage =
  | 'raeume'
  | 'kinder'
  | 'tafeln'
  | 'zugaenge'

export type Route =
  | { view: 'home' }
  | { view: 'klasse'; id: string }
  | { view: 'raum'; id: string }
  | { view: 'verwaltung'; page: VerwaltungPage }
  /** Old addresses; App redirects to `to`. */
  | { view: 'verwaltung-alias'; to: VerwaltungPage }

const VERWALTUNG_PAGES: readonly VerwaltungPage[] = ['raeume', 'kinder', 'tafeln', 'zugaenge']

/** Slugs of pages that no longer exist, and where they went. */
const LEGACY_PAGES: Record<string, VerwaltungPage> = {
  klassen: 'kinder',
  klassenlisten: 'kinder',
}

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'klasse' && parts[1]) return { view: 'klasse', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'raum' && parts[1]) return { view: 'raum', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'verwaltung') {
    const page = parts[1] as VerwaltungPage
    if (VERWALTUNG_PAGES.includes(page)) return { view: 'verwaltung', page }
    if (parts[1] && LEGACY_PAGES[parts[1]]) return { view: 'verwaltung-alias', to: LEGACY_PAGES[parts[1]] }
    return { view: 'verwaltung-alias', to: 'raeume' }
  }
  if (parts[0] === 'admin') return { view: 'verwaltung-alias', to: 'raeume' }
  return { view: 'home' }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parse(hash)
}
