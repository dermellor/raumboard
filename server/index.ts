import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import * as board from './board'
import { hashSecret, makeToken, verifySecret, verifyToken } from './auth'
import { BASE_DOMAIN, DEFAULT_TENANT, DEMO_TENANT, openTenant, slugFromHost, tenantExists } from './tenant'
import {
  DEMO_SCHOOL_NAME,
  demoBoardId,
  demoCredentials,
  isDemoBoard,
  isSession,
  newSession,
  openDemoBoard,
  resetDemoBoard,
  startDemoSweeper,
} from './demo'
import { broadcast, register } from './ws'
import { buildSeed } from '../src/seed'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(HERE, '..', 'dist')
const PORT = Number(process.env.RAUMBOARD_PORT ?? 3211)
const PROD = process.env.NODE_ENV === 'production'

// Local development convenience: with `RAUMBOARD_DEV=1` (set by `npm run dev:api`,
// never in production) auto-provision the default tenant with seed data and known
// credentials, so the real API mode "just works" locally without deploying or CLI.
// Guarded by !PROD so a self-hosted single-tenant production install is untouched.
// Not when the default tenant IS the demo: that instance has no stored board to
// provision, every visitor gets a fresh one from RAM.
const DEV = process.env.RAUMBOARD_DEV === '1' && !PROD
if (DEV && DEFAULT_TENANT && DEFAULT_TENANT !== DEMO_TENANT) {
  const fresh = !tenantExists(DEFAULT_TENANT)
  const db = openTenant(DEFAULT_TENANT, { create: true })
  if (fresh) {
    board.replaceAll(db, buildSeed())
    board.setConfig(db, 'school_name', 'Lokale Testschule')
  }
  // known dev credentials (idempotent; keeps board data across restarts)
  board.setConfig(db, 'admin_email', 'dev@raumboard.local')
  board.setConfig(db, 'admin_hash', hashSecret('raumboard'))
  board.setConfig(db, 'pin_hash', hashSecret('0000'))
  board.setConfig(db, 'pin_length', '4')
  console.log('DEV: Mandant "%s" bereit — Login dev@raumboard.local / raumboard, PIN 0000', DEFAULT_TENANT)
}

const ADMIN_TTL = 30 * 24 * 3600
const BOARD_TTL = 180 * 24 * 3600

/**
 * What a request acts on. For a school that is its tenant slug; for the demo it
 * is one throwaway board per browser session, so the id carries the session.
 * Everything downstream (SQLite handle, WS registry, cookie tokens) is keyed by
 * this string, which is what keeps two demo visitors apart.
 */
type Env = { Variables: { boardId: string } }
const app = new Hono<Env>()

const DEMO_COOKIE = 'rb_demo'
const DEMO_TTL = 12 * 3600

// --- TLS on-demand check (Caddy `ask`) --------------------------------------

app.get('/ask', (c) => {
  const domain = c.req.query('domain') ?? ''
  const host = domain.split(':')[0].toLowerCase()
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) return c.text('ok')
  const slug = slugFromHost(host)
  // the demo answers for its own host although it has no database file
  if (slug && (slug === DEMO_TENANT || tenantExists(slug))) return c.text('ok')
  return c.text('unknown', 404)
})

// --- helpers -----------------------------------------------------------------

function authInfo(c: any, boardId: string) {
  const isAdmin = verifyToken(getCookie(c, 'rb_admin'), boardId, 'admin')
  const hasBoard = verifyToken(getCookie(c, 'rb_board'), boardId, 'board')
  return { isAdmin, canBook: isAdmin || hasBoard }
}

function openBoard(boardId: string) {
  return isDemoBoard(boardId) ? openDemoBoard(boardId) : openTenant(boardId)
}

function stateMessage(boardId: string) {
  const db = openBoard(boardId)
  return { type: 'state', state: board.loadState(db) }
}

function cookieOpts() {
  return { httpOnly: true, secure: PROD, sameSite: 'Lax' as const, path: '/' }
}

/** This browser's demo board, minting the session cookie on first contact. */
function demoBoardFor(c: any): string {
  const existing = getCookie(c, DEMO_COOKIE)
  if (isSession(existing)) return demoBoardId(existing)
  const session = newSession()
  setCookie(c, DEMO_COOKIE, session, { ...cookieOpts(), maxAge: DEMO_TTL })
  return demoBoardId(session)
}

/** Host → board id, or null for the landing page and unknown schools. */
function boardFor(c: any): string | null {
  const slug = slugFromHost(c.req.header('host'))
  if (!slug) return null
  if (slug === DEMO_TENANT) return demoBoardFor(c)
  return tenantExists(slug) ? slug : null
}

// --- API ----------------------------------------------------------------------

const api = new Hono<Env>()

api.use('*', async (c, next) => {
  const boardId = boardFor(c)
  if (!boardId) return c.json({ error: 'unknown tenant' }, 404)
  c.set('boardId', boardId)
  await next()
})

api.get('/state', (c) => {
  const boardId = c.get('boardId')
  const db = openBoard(boardId)
  const { isAdmin, canBook } = authInfo(c, boardId)
  return c.json({
    state: board.loadState(db),
    meta: {
      mode: 'api',
      schoolName: board.getConfig(db, 'school_name') ?? boardId,
      isAdmin,
      canBook,
      dev: DEV,
      // throwaway demo board: nothing is stored, so the UI may offer a reset
      ephemeral: isDemoBoard(boardId),
      // published anyway, and prefilled so a visitor reaches the product directly
      demoCredentials: isDemoBoard(boardId) ? demoCredentials() : null,
      // digit count of the teacher PIN, so the gate can show the right number of
      // slots. Only the length (not the PIN) — harmless for an anti-mischief PIN.
      pinLength: Number(board.getConfig(db, 'pin_length')) || null,
    },
  })
})

api.post('/login', async (c) => {
  const boardId = c.get('boardId')
  const db = openBoard(boardId)
  const { email, password } = await c.req.json<{ email?: string; password?: string }>()
  const storedEmail = board.getConfig(db, 'admin_email')
  const storedHash = board.getConfig(db, 'admin_hash')
  if (
    !email || !password || !storedEmail || !storedHash ||
    email.trim().toLowerCase() !== storedEmail.toLowerCase() ||
    !verifySecret(password, storedHash)
  )
    return c.json({ error: 'E-Mail oder Passwort falsch' }, 401)
  setCookie(c, 'rb_admin', makeToken(boardId, 'admin', ADMIN_TTL), { ...cookieOpts(), maxAge: ADMIN_TTL })
  return c.json({ ok: true })
})

api.post('/logout', (c) => {
  deleteCookie(c, 'rb_admin', { path: '/' })
  deleteCookie(c, 'rb_board', { path: '/' })
  return c.json({ ok: true })
})

api.post('/pin', async (c) => {
  const boardId = c.get('boardId')
  const db = openBoard(boardId)
  const { pin } = await c.req.json<{ pin?: string }>()
  const storedHash = board.getConfig(db, 'pin_hash')
  if (!pin || !storedHash || !verifySecret(pin.trim(), storedHash))
    return c.json({ error: 'PIN falsch' }, 401)
  setCookie(c, 'rb_board', makeToken(boardId, 'board', BOARD_TTL), { ...cookieOpts(), maxAge: BOARD_TTL })
  return c.json({ ok: true })
})

/** Booking mutations need an unlocked board (teacher PIN) or admin. */
api.use('/book', boardGuard)
api.use('/unbook', boardGuard)
api.use('/reset', boardGuard)
async function boardGuard(c: any, next: () => Promise<void>) {
  if (!authInfo(c, c.get('boardId')).canBook) return c.json({ error: 'locked' }, 401)
  await next()
}

api.post('/book', async (c) => {
  const boardId = c.get('boardId')
  const { kidId, roomId } = await c.req.json<{ kidId?: string; roomId?: string }>()
  if (!kidId || !roomId) return c.json({ error: 'kidId/roomId fehlt' }, 400)
  const result = board.book(openBoard(boardId), kidId, roomId)
  if (!result.ok) return c.json(result, 409)
  broadcast(boardId, stateMessage(boardId))
  return c.json(result)
})

api.post('/unbook', async (c) => {
  const boardId = c.get('boardId')
  const { kidId } = await c.req.json<{ kidId?: string }>()
  if (!kidId) return c.json({ error: 'kidId fehlt' }, 400)
  board.unbook(openBoard(boardId), kidId)
  broadcast(boardId, stateMessage(boardId))
  return c.json({ ok: true })
})

api.post('/reset', (c) => {
  const boardId = c.get('boardId')
  board.reset(openBoard(boardId))
  broadcast(boardId, stateMessage(boardId))
  return c.json({ ok: true })
})

/**
 * Back to the seed data. Open to anyone on a demo board, because that board is
 * the visitor's own throwaway copy and undoing their mess is the point; also
 * allowed in local dev. On a school's board it is refused outright, so real
 * children's data can never be destroyed through the API.
 */
api.post('/reseed', (c) => {
  const boardId = c.get('boardId')
  if (isDemoBoard(boardId)) resetDemoBoard(boardId)
  else if (DEV) board.replaceAll(openBoard(boardId), buildSeed())
  else return c.json({ error: 'nicht erlaubt' }, 403)
  broadcast(boardId, stateMessage(boardId))
  return c.json({ ok: true })
})

/** Admin CRUD. */
api.use('/admin/*', async (c, next) => {
  if (!authInfo(c, c.get('boardId')).isAdmin) return c.json({ error: 'admin required' }, 401)
  await next()
})

api.post('/admin/import', async (c) => {
  const boardId = c.get('boardId')
  const body = await c.req.json<{
    mode?: 'append' | 'replace'
    targetKlass?: string | null
    kids?: { name?: string; symbol?: string; klass?: string | null }[]
  }>()
  const kids = (body.kids ?? [])
    .map((k) => ({ name: (k.name ?? '').trim(), symbol: (k.symbol ?? '').trim(), klass: k.klass ?? null }))
    .filter((k) => k.name)
  if (kids.length === 0) return c.json({ error: 'keine Kinder in der Datei' }, 400)
  const mode = body.mode === 'replace' ? 'replace' : 'append'
  const result = board.importKids(openBoard(boardId), kids, body.targetKlass ?? null, mode)
  broadcast(boardId, stateMessage(boardId))
  return c.json({ ok: true, ...result })
})

api.post('/admin/rooms', async (c) => {
  const { name, emoji, capacity, scope } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'name fehlt' }, 400)
  board.addRoom(openBoard(c.get('boardId')), name.trim(), emoji || '🚪', Number(capacity) || 0, scope || 'all')
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.patch('/admin/rooms/:id', async (c) => {
  board.updateRoom(openBoard(c.get('boardId')), c.req.param('id'), await c.req.json())
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.delete('/admin/rooms/:id', (c) => {
  board.removeRoom(openBoard(c.get('boardId')), c.req.param('id'))
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.post('/admin/kids', async (c) => {
  const { klassId, symbol, name } = await c.req.json()
  if (!name?.trim() || !klassId) return c.json({ error: 'name/klassId fehlt' }, 400)
  board.addKid(openBoard(c.get('boardId')), klassId, symbol || '⭐', name.trim())
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.patch('/admin/kids/:id', async (c) => {
  board.updateKid(openBoard(c.get('boardId')), c.req.param('id'), await c.req.json())
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.delete('/admin/kids/:id', (c) => {
  board.removeKid(openBoard(c.get('boardId')), c.req.param('id'))
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.post('/admin/klasses', async (c) => {
  const { name, emoji } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'name fehlt' }, 400)
  board.addKlass(openBoard(c.get('boardId')), name.trim(), emoji || undefined)
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.patch('/admin/klasses/:id', async (c) => {
  board.updateKlass(openBoard(c.get('boardId')), c.req.param('id'), await c.req.json())
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.delete('/admin/klasses/:id', (c) => {
  board.removeKlass(openBoard(c.get('boardId')), c.req.param('id'))
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

/** Credentials self-service — both re-verify the current admin password. */
api.post('/admin/change-password', async (c) => {
  const db = openBoard(c.get('boardId'))
  const { current, next } = await c.req.json<{ current?: string; next?: string }>()
  const storedHash = board.getConfig(db, 'admin_hash')
  if (!current || !storedHash || !verifySecret(current, storedHash))
    return c.json({ error: 'Aktuelles Passwort falsch' }, 401)
  if (!next || next.length < 10)
    return c.json({ error: 'Neues Passwort braucht mindestens 10 Zeichen' }, 400)
  board.setConfig(db, 'admin_hash', hashSecret(next))
  return c.json({ ok: true })
})

api.post('/admin/change-pin', async (c) => {
  const db = openBoard(c.get('boardId'))
  const { password, pin } = await c.req.json<{ password?: string; pin?: string }>()
  const storedHash = board.getConfig(db, 'admin_hash')
  if (!password || !storedHash || !verifySecret(password, storedHash))
    return c.json({ error: 'Passwort falsch' }, 401)
  if (!pin || !/^\d{4,8}$/.test(pin.trim()))
    return c.json({ error: 'PIN muss aus 4–8 Ziffern bestehen' }, 400)
  board.setConfig(db, 'pin_hash', hashSecret(pin.trim()))
  board.setConfig(db, 'pin_length', String(pin.trim().length))
  return c.json({ ok: true })
})

app.route('/api', api)

// --- static frontend -----------------------------------------------------------

const indexHtml = existsSync(path.join(DIST, 'index.html'))
  ? readFileSync(path.join(DIST, 'index.html'), 'utf8')
  : null

const LANDING = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Raumboard</title></head>
<body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:0 1rem">
<h1>Raumboard</h1>
<p>Das offene Lernraum-Board für Schulen. Jede Schule erreicht ihr Board unter ihrer eigenen Adresse
(<code>schulname.${BASE_DOMAIN}</code>).</p>
</body></html>`

app.use('/assets/*', serveStatic({ root: path.relative(process.cwd(), DIST) }))
app.use('/favicon.svg', serveStatic({ root: path.relative(process.cwd(), DIST) }))

app.get('*', (c) => {
  const slug = slugFromHost(c.req.header('host'))
  if (!slug) return c.html(LANDING)
  const demo = slug === DEMO_TENANT
  if (!demo && !tenantExists(slug))
    return c.html(`<!doctype html><meta charset="utf-8"><title>Unbekannte Schule</title>
<p style="font-family:system-ui;margin:4rem auto;max-width:30rem">Diese Schul-Adresse ist nicht eingerichtet.</p>`, 404)
  if (!indexHtml) return c.text('frontend build fehlt (npm run build)', 500)
  let schoolName: string
  if (demo) {
    // mint the session cookie here, before the app boots and opens its WebSocket;
    // the name comes from config so no board has to be created just to render HTML
    demoBoardFor(c)
    schoolName = DEMO_SCHOOL_NAME
  } else {
    schoolName = board.getConfig(openTenant(slug), 'school_name') ?? slug
  }
  const config = JSON.stringify({ schoolName })
  return c.html(indexHtml.replace('</head>', `<script>window.__RAUMBOARD__=${config}</script></head>`))
})

// --- boot ------------------------------------------------------------------------

const server = serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, (info) => {
  console.log(`raumboard server on http://127.0.0.1:${info.port} (domain: ${BASE_DOMAIN})`)
  if (DEMO_TENANT)
    console.log(
      `Demo: ${DEMO_TENANT}.${BASE_DOMAIN} — pro Besucher ein eigenes Board, nur im Speicher`,
    )
})
startDemoSweeper()

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== '/api/ws') {
    socket.destroy()
    return
  }
  const boardId = wsBoardId(req.headers.host, req.headers.cookie)
  if (!boardId) {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    register(boardId, ws)
    ws.send(JSON.stringify(stateMessage(boardId)))
  })
})

/**
 * Same resolution as `boardFor`, from raw upgrade headers (no Hono context here).
 * A demo socket without the session cookie is refused rather than pointed at a
 * new board: the page load sets that cookie, so the client only has to reconnect.
 */
function wsBoardId(host: string | undefined, cookieHeader: string | undefined): string | null {
  const slug = slugFromHost(host)
  if (!slug) return null
  if (slug === DEMO_TENANT) {
    const session = cookieValue(cookieHeader, DEMO_COOKIE)
    return isSession(session) ? demoBoardId(session) : null
  }
  return tenantExists(slug) ? slug : null
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}
