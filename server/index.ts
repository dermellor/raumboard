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
import { BASE_DOMAIN, openTenant, slugFromHost, tenantExists } from './tenant'
import { broadcast, register } from './ws'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(HERE, '..', 'dist')
const PORT = Number(process.env.RAUMBOARD_PORT ?? 3211)
const PROD = process.env.NODE_ENV === 'production'

const ADMIN_TTL = 30 * 24 * 3600
const BOARD_TTL = 180 * 24 * 3600

type Env = { Variables: { slug: string } }
const app = new Hono<Env>()

// --- TLS on-demand check (Caddy `ask`) --------------------------------------

app.get('/ask', (c) => {
  const domain = c.req.query('domain') ?? ''
  const host = domain.split(':')[0].toLowerCase()
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) return c.text('ok')
  const slug = slugFromHost(host)
  if (slug && tenantExists(slug)) return c.text('ok')
  return c.text('unknown', 404)
})

// --- helpers -----------------------------------------------------------------

function authInfo(c: any, slug: string) {
  const isAdmin = verifyToken(getCookie(c, 'rb_admin'), slug, 'admin')
  const hasBoard = verifyToken(getCookie(c, 'rb_board'), slug, 'board')
  return { isAdmin, canBook: isAdmin || hasBoard }
}

function stateMessage(slug: string) {
  const db = openTenant(slug)
  return { type: 'state', state: board.loadState(db) }
}

function cookieOpts() {
  return { httpOnly: true, secure: PROD, sameSite: 'Lax' as const, path: '/' }
}

// --- API ----------------------------------------------------------------------

const api = new Hono<Env>()

api.use('*', async (c, next) => {
  const slug = slugFromHost(c.req.header('host'))
  if (!slug || !tenantExists(slug)) return c.json({ error: 'unknown tenant' }, 404)
  c.set('slug', slug)
  await next()
})

api.get('/state', (c) => {
  const slug = c.get('slug')
  const db = openTenant(slug)
  const { isAdmin, canBook } = authInfo(c, slug)
  return c.json({
    state: board.loadState(db),
    meta: {
      mode: 'api',
      schoolName: board.getConfig(db, 'school_name') ?? slug,
      isAdmin,
      canBook,
    },
  })
})

api.post('/login', async (c) => {
  const slug = c.get('slug')
  const db = openTenant(slug)
  const { email, password } = await c.req.json<{ email?: string; password?: string }>()
  const storedEmail = board.getConfig(db, 'admin_email')
  const storedHash = board.getConfig(db, 'admin_hash')
  if (
    !email || !password || !storedEmail || !storedHash ||
    email.trim().toLowerCase() !== storedEmail.toLowerCase() ||
    !verifySecret(password, storedHash)
  )
    return c.json({ error: 'E-Mail oder Passwort falsch' }, 401)
  setCookie(c, 'rb_admin', makeToken(slug, 'admin', ADMIN_TTL), { ...cookieOpts(), maxAge: ADMIN_TTL })
  return c.json({ ok: true })
})

api.post('/logout', (c) => {
  deleteCookie(c, 'rb_admin', { path: '/' })
  deleteCookie(c, 'rb_board', { path: '/' })
  return c.json({ ok: true })
})

api.post('/pin', async (c) => {
  const slug = c.get('slug')
  const db = openTenant(slug)
  const { pin } = await c.req.json<{ pin?: string }>()
  const storedHash = board.getConfig(db, 'pin_hash')
  if (!pin || !storedHash || !verifySecret(pin.trim(), storedHash))
    return c.json({ error: 'PIN falsch' }, 401)
  setCookie(c, 'rb_board', makeToken(slug, 'board', BOARD_TTL), { ...cookieOpts(), maxAge: BOARD_TTL })
  return c.json({ ok: true })
})

/** Booking mutations need an unlocked board (teacher PIN) or admin. */
api.use('/book', boardGuard)
api.use('/unbook', boardGuard)
api.use('/reset', boardGuard)
async function boardGuard(c: any, next: () => Promise<void>) {
  if (!authInfo(c, c.get('slug')).canBook) return c.json({ error: 'locked' }, 401)
  await next()
}

api.post('/book', async (c) => {
  const slug = c.get('slug')
  const { kidId, roomId } = await c.req.json<{ kidId?: string; roomId?: string }>()
  if (!kidId || !roomId) return c.json({ error: 'kidId/roomId fehlt' }, 400)
  const result = board.book(openTenant(slug), kidId, roomId)
  if (!result.ok) return c.json(result, 409)
  broadcast(slug, stateMessage(slug))
  return c.json(result)
})

api.post('/unbook', async (c) => {
  const slug = c.get('slug')
  const { kidId } = await c.req.json<{ kidId?: string }>()
  if (!kidId) return c.json({ error: 'kidId fehlt' }, 400)
  board.unbook(openTenant(slug), kidId)
  broadcast(slug, stateMessage(slug))
  return c.json({ ok: true })
})

api.post('/reset', (c) => {
  const slug = c.get('slug')
  board.reset(openTenant(slug))
  broadcast(slug, stateMessage(slug))
  return c.json({ ok: true })
})

/** Admin CRUD. */
api.use('/admin/*', async (c, next) => {
  if (!authInfo(c, c.get('slug')).isAdmin) return c.json({ error: 'admin required' }, 401)
  await next()
})

api.post('/admin/rooms', async (c) => {
  const { name, emoji, capacity, scope } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'name fehlt' }, 400)
  board.addRoom(openTenant(c.get('slug')), name.trim(), emoji || '🚪', Number(capacity) || 0, scope || 'all')
  broadcast(c.get('slug'), stateMessage(c.get('slug')))
  return c.json({ ok: true })
})

api.patch('/admin/rooms/:id', async (c) => {
  board.updateRoom(openTenant(c.get('slug')), c.req.param('id'), await c.req.json())
  broadcast(c.get('slug'), stateMessage(c.get('slug')))
  return c.json({ ok: true })
})

api.delete('/admin/rooms/:id', (c) => {
  board.removeRoom(openTenant(c.get('slug')), c.req.param('id'))
  broadcast(c.get('slug'), stateMessage(c.get('slug')))
  return c.json({ ok: true })
})

api.post('/admin/kids', async (c) => {
  const { klassId, symbol, name } = await c.req.json()
  if (!name?.trim() || !klassId) return c.json({ error: 'name/klassId fehlt' }, 400)
  board.addKid(openTenant(c.get('slug')), klassId, symbol || '⭐', name.trim())
  broadcast(c.get('slug'), stateMessage(c.get('slug')))
  return c.json({ ok: true })
})

api.patch('/admin/kids/:id', async (c) => {
  board.updateKid(openTenant(c.get('slug')), c.req.param('id'), await c.req.json())
  broadcast(c.get('slug'), stateMessage(c.get('slug')))
  return c.json({ ok: true })
})

api.delete('/admin/kids/:id', (c) => {
  board.removeKid(openTenant(c.get('slug')), c.req.param('id'))
  broadcast(c.get('slug'), stateMessage(c.get('slug')))
  return c.json({ ok: true })
})

api.post('/admin/klasses', async (c) => {
  const { name, emoji } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'name fehlt' }, 400)
  board.addKlass(openTenant(c.get('slug')), name.trim(), emoji || undefined)
  broadcast(c.get('slug'), stateMessage(c.get('slug')))
  return c.json({ ok: true })
})

api.patch('/admin/klasses/:id', async (c) => {
  board.updateKlass(openTenant(c.get('slug')), c.req.param('id'), await c.req.json())
  broadcast(c.get('slug'), stateMessage(c.get('slug')))
  return c.json({ ok: true })
})

api.delete('/admin/klasses/:id', (c) => {
  board.removeKlass(openTenant(c.get('slug')), c.req.param('id'))
  broadcast(c.get('slug'), stateMessage(c.get('slug')))
  return c.json({ ok: true })
})

/** Credentials self-service — both re-verify the current admin password. */
api.post('/admin/change-password', async (c) => {
  const db = openTenant(c.get('slug'))
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
  const db = openTenant(c.get('slug'))
  const { password, pin } = await c.req.json<{ password?: string; pin?: string }>()
  const storedHash = board.getConfig(db, 'admin_hash')
  if (!password || !storedHash || !verifySecret(password, storedHash))
    return c.json({ error: 'Passwort falsch' }, 401)
  if (!pin || !/^\d{4,8}$/.test(pin.trim()))
    return c.json({ error: 'PIN muss aus 4–8 Ziffern bestehen' }, 400)
  board.setConfig(db, 'pin_hash', hashSecret(pin.trim()))
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
  if (!tenantExists(slug))
    return c.html(`<!doctype html><meta charset="utf-8"><title>Unbekannte Schule</title>
<p style="font-family:system-ui;margin:4rem auto;max-width:30rem">Diese Schul-Adresse ist nicht eingerichtet.</p>`, 404)
  if (!indexHtml) return c.text('frontend build fehlt (npm run build)', 500)
  const db = openTenant(slug)
  const config = JSON.stringify({
    schoolName: board.getConfig(db, 'school_name') ?? slug,
  })
  return c.html(indexHtml.replace('</head>', `<script>window.__RAUMBOARD__=${config}</script></head>`))
})

// --- boot ------------------------------------------------------------------------

const server = serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, (info) => {
  console.log(`raumboard server on http://127.0.0.1:${info.port} (domain: ${BASE_DOMAIN})`)
})

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== '/api/ws') {
    socket.destroy()
    return
  }
  const slug = slugFromHost(req.headers.host)
  if (!slug || !tenantExists(slug)) {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    register(slug, ws)
    ws.send(JSON.stringify(stateMessage(slug)))
  })
})
