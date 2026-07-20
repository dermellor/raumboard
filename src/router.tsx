import { useSyncExternalStore } from 'react'

export type Route =
  | { view: 'home' }
  | { view: 'klasse'; id: string }
  | { view: 'raum'; id: string }
  | { view: 'admin' }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'klasse' && parts[1]) return { view: 'klasse', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'raum' && parts[1]) return { view: 'raum', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'admin') return { view: 'admin' }
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
