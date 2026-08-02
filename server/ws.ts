import type { WebSocket } from 'ws'

// Per-tenant WebSocket registry. Broadcasts carry the full board state —
// small enough (~250 kids) that diffing isn't worth the complexity.

const sockets = new Map<string, Set<WebSocket>>()

export function register(slug: string, ws: WebSocket): void {
  let set = sockets.get(slug)
  if (!set) {
    set = new Set()
    sockets.set(slug, set)
  }
  set.add(ws)
  ws.on('close', () => set.delete(ws))
}

export function broadcast(slug: string, message: object): void {
  const set = sockets.get(slug)
  if (!set) return
  const data = JSON.stringify(message)
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(data)
  }
}
