import type { WebSocket } from 'ws'

// Per-board WebSocket registry. Broadcasts carry the full board state —
// small enough (~250 kids) that diffing isn't worth the complexity.
//
// Keys are board ids, so a demo visitor's session is its own entry. There are as
// many of those as there are visitors, which is why an emptied set is removed
// instead of left behind.

const sockets = new Map<string, Set<WebSocket>>()

export function register(boardId: string, ws: WebSocket): void {
  let set = sockets.get(boardId)
  if (!set) {
    set = new Set()
    sockets.set(boardId, set)
  }
  set.add(ws)
  ws.on('close', () => {
    set.delete(ws)
    if (set.size === 0) sockets.delete(boardId)
  })
}

export function broadcast(boardId: string, message: object): void {
  const set = sockets.get(boardId)
  if (!set) return
  const data = JSON.stringify(message)
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(data)
  }
}
