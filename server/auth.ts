import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'

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

// --- generated secrets ------------------------------------------------------
//
// New and reset passwords are generated and shown once (no plaintext is stored),
// so they have to be readable enough to dictate over the phone. Shared by the
// CLI and the in-app account routes so both hand out the same shape.

export function generatePassword(): string {
  // 3 blocks of 4 lowercase alnum, ambiguous characters left out
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const block = () => Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join('')
  return `${block()}-${block()}-${block()}`
}

export function generatePin(): string {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

// --- signed tokens --------------------------------------------------------

export type TokenKind = 'board' | 'teacher'

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

/**
 * Board and teacher tokens carry the school's current unlock epoch. Changing
 * the teacher PIN increments that value and invalidates every token at once.
 */
export function makeToken(tenant: string, kind: TokenKind, epoch: number, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = `${tenant}.${kind}.${epoch}.${exp}`
  return `${payload}.${sign(payload)}`
}

export function verifyToken(
  token: string | undefined,
  tenant: string,
  kind: TokenKind,
  epoch: number,
): boolean {
  if (!token) return false
  const idx = token.lastIndexOf('.')
  if (idx < 0) return false
  const payload = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = sign(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return false
  const parts = payload.split('.')
  if (parts.length !== 4) return false
  const [t, k, epochStr, expStr] = parts
  return t === tenant && k === kind && Number(epochStr) === epoch && Number(expStr) > Date.now() / 1000
}

// --- admin tokens (carry the account id) -----------------------------------
//
// A school can have several accounts now, so the admin cookie has to say *which*
// one. The board token stays the plain `tenant.board.exp` above (nothing about a
// device is per-account); the admin token adds the account id as a fourth field.
// Neither a slug nor the id contains a dot, so the payload splits unambiguously.

export function makeAdminToken(tenant: string, userId: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = `${tenant}.admin.${userId}.${exp}`
  return `${payload}.${sign(payload)}`
}

/** The account id a valid admin token carries, or null. Existence/active state
 * is re-checked against the database by the caller, so a deactivated account's
 * still-signed cookie stops working immediately. */
export function verifyAdminToken(token: string | undefined, tenant: string): string | null {
  if (!token) return null
  const idx = token.lastIndexOf('.')
  if (idx < 0) return null
  const payload = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = sign(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return null
  const parts = payload.split('.')
  if (parts.length !== 4) return null
  const [t, k, userId, expStr] = parts
  if (t !== tenant || k !== 'admin' || !(Number(expStr) > Date.now() / 1000)) return null
  return userId
}
