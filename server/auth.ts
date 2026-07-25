import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// scrypt for password/PIN hashes (memory-hard, built into node), HMAC-signed
// stateless tokens for cookies. No session storage.

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 }

export const SECRET =
  process.env.RAUMBOARD_SECRET ??
  (() => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('RAUMBOARD_SECRET fehlt (Env, min. 32 Zeichen)')
    return randomBytes(32).toString('hex') // dev: per-boot secret
  })()

export function hashSecret(plain: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(plain, salt, SCRYPT.keylen, SCRYPT)
  return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt.toString('base64url')}:${hash.toString('base64url')}`
}

export function verifySecret(plain: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, hashB64] = parts
  const expected = Buffer.from(hashB64, 'base64url')
  const actual = scryptSync(plain, Buffer.from(saltB64, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// --- signed tokens --------------------------------------------------------

export type TokenKind = 'admin' | 'board'

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function makeToken(tenant: string, kind: TokenKind, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = `${tenant}.${kind}.${exp}`
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token: string | undefined, tenant: string, kind: TokenKind): boolean {
  if (!token) return false
  const idx = token.lastIndexOf('.')
  if (idx < 0) return false
  const payload = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = sign(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return false
  const [t, k, expStr] = payload.split('.')
  return t === tenant && k === kind && Number(expStr) > Date.now() / 1000
}
