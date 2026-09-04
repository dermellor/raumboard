import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import * as board from './board'
import {
  generatePassword,
  hashSecret,
  makeAdminToken,
  makeToken,
  verifyAdminToken,
  verifySecret,
  verifyToken,
} from './auth'
import type { Role } from '../src/types'
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
  // known dev credentials (idempotent; keeps board data across restarts). The
  // login is an owner account now; create it once, then keep its password fixed.
  const devEmail = 'dev@raumboard.local'
  const devOwner = board.findUserByEmail(db, devEmail)
  if (devOwner) board.setUserPassword(db, devOwner.id, hashSecret('raumboard'))
  else board.createUser(db, devEmail, hashSecret('raumboard'), 'owner')
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
export const app = new Hono<Env>()

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

/**
 * `canOperate` is the teacher level: today's bookings *and* the Verwaltung
 * (rooms, classes, kids). `isAdmin` means a signed-in account, needed for the
 * import, the account's own credentials, and (owners) the account management.
 * The admin cookie carries the account id; it is resolved against the database
 * on every request, so a deactivated account's still-signed cookie is dead at
 * once — unlike the PIN, which a new value cannot revoke.
 */
function authInfo(c: any, boardId: string) {
  const userId = verifyAdminToken(getCookie(c, 'rb_admin'), boardId)
  const account = userId ? board.getActiveUser(openBoard(boardId), userId) : undefined
  const hasBoard = verifyToken(getCookie(c, 'rb_board'), boardId, 'board')
  return { isAdmin: !!account, canOperate: !!account || hasBoard, account }
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
  const { isAdmin, canOperate, account } = authInfo(c, boardId)
  return c.json({
    state: board.loadState(db),
    meta: {
      mode: 'api',
      schoolName: board.getConfig(db, 'school_name') ?? boardId,
      isAdmin,
      canOperate,
      // who is signed in, so the UI can greet them and show the owner-only tab
      account: account ? { email: account.email, role: account.role } : null,
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
  const user = email ? board.findUserByEmail(db, email) : undefined
  if (!user || !password || !verifySecret(password, user.passHash))
    return c.json({ error: 'E-Mail oder Passwort falsch' }, 401)
  setCookie(c, 'rb_admin', makeAdminToken(boardId, user.id, ADMIN_TTL), {
    ...cookieOpts(),
    maxAge: ADMIN_TTL,
  })
  return c.json({ ok: true })
})

/**
 * Ends the admin session only. The device unlock survives on purpose: signing
 * off after an import must not lock the whiteboard the class books on.
 */
api.post('/logout', (c) => {
  deleteCookie(c, 'rb_admin', { path: '/' })
  return c.json({ ok: true })
})

/** Locks this device again: both cookies go, the PIN is asked for next time. */
api.post('/lock', (c) => {
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

/**
 * Everything the teacher PIN unlocks: today's bookings and the Verwaltung.
 * Collection and item paths are listed separately because `/rooms/*` does not
 * match a POST to `/rooms` itself.
 */
const BOARD_PATHS = [
  '/book', '/unbook', '/reset',
  '/rooms', '/rooms/*', '/kids', '/kids/*', '/klasses', '/klasses/*',
]
for (const p of BOARD_PATHS) api.use(p, boardGuard)

async function boardGuard(c: any, next: () => Promise<void>) {
  if (!authInfo(c, c.get('boardId')).canOperate) return c.json({ error: 'locked' }, 401)
  await next()
}

/**
 * The account's own credentials. These need to know *which* account, so they
 * require a signed-in session (the admin cookie), not just the PIN: the body
 * password is checked against that account. A PIN-only device is refused here.
 */
async function adminGuard(c: any, next: () => Promise<void>) {
  if (!authInfo(c, c.get('boardId')).isAdmin) return c.json({ error: 'admin required' }, 401)
  await next()
}
for (const p of ['/verify-password', '/change-password', '/change-pin']) api.use(p, adminGuard)

/**
 * Managing *other* accounts is the owner's job only. Its own prefix, with a
 * guard stricter than `/admin/` (which any account passes): an admin can import
 * and change its own password, but cannot touch the roster.
 */
async function ownerGuard(c: any, next: () => Promise<void>) {
  if (authInfo(c, c.get('boardId')).account?.role !== 'owner')
    return c.json({ error: 'owner required' }, 403)
  await next()
}
for (const p of ['/accounts', '/accounts/*']) api.use(p, ownerGuard)

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

/**
 * The account level, and the import is all of it. It is the one mutation that
 * carries personal data in from outside and can replace the whole school's data
 * in a single step, so the `/admin/` prefix means exactly „needs the login".
 */
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

/** Verwaltung CRUD — teacher level (see BOARD_PATHS). */
api.post('/rooms', async (c) => {
  const { name, emoji, capacity, scope } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'name fehlt' }, 400)
  board.addRoom(openBoard(c.get('boardId')), name.trim(), emoji || '🚪', Number(capacity) || 0, board.normalizeScope(scope))
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.patch('/rooms/:id', async (c) => {
  board.updateRoom(openBoard(c.get('boardId')), c.req.param('id'), await c.req.json())
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.delete('/rooms/:id', (c) => {
  board.removeRoom(openBoard(c.get('boardId')), c.req.param('id'))
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.post('/kids', async (c) => {
  const { klassId, symbol, name } = await c.req.json()
  if (!name?.trim() || !klassId) return c.json({ error: 'name/klassId fehlt' }, 400)
  board.addKid(openBoard(c.get('boardId')), klassId, symbol || '⭐', name.trim())
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.patch('/kids/:id', async (c) => {
  board.updateKid(openBoard(c.get('boardId')), c.req.param('id'), await c.req.json())
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.delete('/kids/:id', (c) => {
  board.removeKid(openBoard(c.get('boardId')), c.req.param('id'))
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.post('/klasses', async (c) => {
  const { name, emoji } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'name fehlt' }, 400)
  board.addKlass(openBoard(c.get('boardId')), name.trim(), emoji || undefined)
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.patch('/klasses/:id', async (c) => {
  board.updateKlass(openBoard(c.get('boardId')), c.req.param('id'), await c.req.json())
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

api.delete('/klasses/:id', (c) => {
  board.removeKlass(openBoard(c.get('boardId')), c.req.param('id'))
  broadcast(c.get('boardId'), stateMessage(c.get('boardId')))
  return c.json({ ok: true })
})

/**
 * Credentials self-service for the signed-in account. All three re-verify a
 * password from the body against *that account*, so the admin cookie only says
 * who you are, and the password proves it is still you at this device (both
 * cookies outlive a school day). The throttle guards the guessing that opens up
 * because the same body-password path is reachable from an unlocked device.
 * `change-pin` changes the school-wide teacher PIN, not anything per-account.
 */
const FAIL_WINDOW_MS = 15 * 60_000
const FAIL_LIMIT = 5
const failures = new Map<string, number[]>()

/** True when this board has burned its attempts; prunes as it goes. */
function throttled(boardId: string): boolean {
  const now = Date.now()
  const recent = (failures.get(boardId) ?? []).filter((t) => now - t < FAIL_WINDOW_MS)
  if (recent.length === 0) failures.delete(boardId)
  else failures.set(boardId, recent)
  return recent.length >= FAIL_LIMIT
}

function noteFailure(boardId: string): void {
  failures.set(boardId, [...(failures.get(boardId) ?? []), Date.now()])
}

const THROTTLED = 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.'

/**
 * Says whether this is the school's password, and changes nothing. The
 * Verwaltung asks for it again before opening „Import" and „Zugangsdaten", the
 * same way the PIN is asked before the page itself: both cookies outlive a
 * school day, so a persisted session may not be what opens those two screens.
 * Shares the throttle with the change endpoints, since it is the same guess.
 */
api.post('/verify-password', async (c) => {
  const boardId = c.get('boardId')
  if (throttled(boardId)) return c.json({ error: THROTTLED }, 429)
  const { password } = await c.req.json<{ password?: string }>()
  const { account } = authInfo(c, boardId)
  const storedHash = account && board.getPassHash(openBoard(boardId), account.id)
  if (!password || !storedHash || !verifySecret(password, storedHash)) {
    noteFailure(boardId)
    return c.json({ error: 'Passwort falsch' }, 401)
  }
  failures.delete(boardId)
  return c.json({ ok: true })
})

api.post('/change-password', async (c) => {
  const boardId = c.get('boardId')
  const db = openBoard(boardId)
  if (throttled(boardId)) return c.json({ error: THROTTLED }, 429)
  const { current, next } = await c.req.json<{ current?: string; next?: string }>()
  const { account } = authInfo(c, boardId)
  const storedHash = account && board.getPassHash(db, account.id)
  if (!current || !storedHash || !verifySecret(current, storedHash)) {
    noteFailure(boardId)
    return c.json({ error: 'Aktuelles Passwort falsch' }, 401)
  }
  if (!next || next.length < 10)
    return c.json({ error: 'Neues Passwort braucht mindestens 10 Zeichen' }, 400)
  board.setUserPassword(db, account.id, hashSecret(next))
  failures.delete(boardId)
  return c.json({ ok: true })
})

api.post('/change-pin', async (c) => {
  const boardId = c.get('boardId')
  const db = openBoard(boardId)
  if (throttled(boardId)) return c.json({ error: THROTTLED }, 429)
  const { password, pin } = await c.req.json<{ password?: string; pin?: string }>()
  const { account } = authInfo(c, boardId)
  const storedHash = account && board.getPassHash(db, account.id)
  if (!password || !storedHash || !verifySecret(password, storedHash)) {
    noteFailure(boardId)
    return c.json({ error: 'Passwort falsch' }, 401)
  }
  if (!pin || !/^\d{4,8}$/.test(pin.trim()))
    return c.json({ error: 'PIN muss aus 4–8 Ziffern bestehen' }, 400)
  board.setConfig(db, 'pin_hash', hashSecret(pin.trim()))
  board.setConfig(db, 'pin_length', String(pin.trim().length))
  failures.delete(boardId)
  return c.json({ ok: true })
})

// --- account management (owner only, see ownerGuard) -------------------------
//
// Deactivating instead of deleting keeps the roster reversible. Two invariants
// are enforced server-side (the UI mirrors them, but the server is the guard):
// the school must keep at least one active owner, and an owner cannot demote or
// deactivate their own account (that would be a foot-gun mid-session — another
// owner does it). New and reset passwords are generated and returned once.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

api.get('/accounts', (c) => {
  return c.json({ accounts: board.listUsers(openBoard(c.get('boardId'))) })
})

api.post('/accounts', async (c) => {
  const db = openBoard(c.get('boardId'))
  const { email, role } = await c.req.json<{ email?: string; role?: string }>()
  const clean = (email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(clean)) return c.json({ error: 'Bitte eine gültige E-Mail angeben' }, 400)
  const password = generatePassword()
  try {
    const account = board.createUser(db, clean, hashSecret(password), role === 'owner' ? 'owner' : 'admin')
    return c.json({ ok: true, account, password })
  } catch {
    return c.json({ error: 'Für diese E-Mail gibt es bereits ein Konto' }, 409)
  }
})

api.patch('/accounts/:id', async (c) => {
  const db = openBoard(c.get('boardId'))
  const acting = authInfo(c, c.get('boardId')).account!
  const id = c.req.param('id')
  const target = board.listUsers(db).find((u) => u.id === id)
  if (!target) return c.json({ error: 'Konto nicht gefunden' }, 404)
  const { role, active } = await c.req.json<{ role?: Role; active?: boolean }>()
  const nextRole: Role | undefined = role === undefined ? undefined : role === 'owner' ? 'owner' : 'admin'
  const demoting = nextRole !== undefined && nextRole !== 'owner' && target.role === 'owner'
  const deactivating = active === false && target.active
  if ((demoting || deactivating) && target.id === acting.id)
    return c.json({ error: 'Das eigene Konto lässt sich nicht herabstufen oder deaktivieren' }, 409)
  if ((demoting || deactivating) && target.role === 'owner' && board.countActiveOwners(db) <= 1)
    return c.json({ error: 'Die Schule braucht mindestens ein aktives Inhaber-Konto' }, 409)
  if (nextRole !== undefined) board.setUserRole(db, id, nextRole)
  if (active !== undefined) board.setUserActive(db, id, active)
  return c.json({ ok: true })
})

api.post('/accounts/:id/reset-password', (c) => {
  const db = openBoard(c.get('boardId'))
  const id = c.req.param('id')
  if (!board.listUsers(db).some((u) => u.id === id)) return c.json({ error: 'Konto nicht gefunden' }, 404)
  const password = generatePassword()
  board.setUserPassword(db, id, hashSecret(password))
  return c.json({ ok: true, password })
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

/**
 * `RAUMBOARD_NO_LISTEN=1` builds the app without binding a port or opening
 * sockets, which is how the access-level test drives it through `app.request`.
 */
if (process.env.RAUMBOARD_NO_LISTEN !== '1') {
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
}

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
