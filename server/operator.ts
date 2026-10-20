import { createHmac, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { SECRET, verifySecret } from './auth'
import { DATA_DIR, BASE_DOMAIN, dbPath, openTenant } from './tenant'
import * as board from './board'

export type InstanceStatus = 'active' | 'attention' | 'onboarding' | 'error'
export type RegistryEntry = {
  slug: string
  schoolName: string
  onboarding?: boolean
  maintenance?: boolean
  version?: string
  certificateExpiresAt?: string | null
  backup?: { status: 'ok' | 'failed' | 'running' | 'unknown'; at?: string; message?: string }
}
export type UsageMetrics = { activeBoards7d: number; activities7d: number; lastActivity: string | null }
export type InstanceSnapshot = RegistryEntry & UsageMetrics & {
  subdomain: string
  status: InstanceStatus
  statusReason: string
}

const REGISTRY_PATH = process.env.RAUMBOARD_OPERATOR_REGISTRY || path.join(DATA_DIR, 'operator-instances.json')
const CACHE_MS = Number(process.env.RAUMBOARD_OPERATOR_CACHE_MS || 60_000)
const VERSION = process.env.RAUMBOARD_VERSION || 'Entwicklung'
const OPERATOR_HASH = process.env.RAUMBOARD_OPERATOR_PASSWORD_HASH?.trim() || ''
const OPERATOR_PASSWORD = process.env.RAUMBOARD_OPERATOR_PASSWORD?.trim() || ''
const DEV_PASSWORD = process.env.RAUMBOARD_DEV === '1' && process.env.NODE_ENV !== 'production' ? 'raumboard-operator' : ''
export const operatorEnabled = Boolean(OPERATOR_HASH || OPERATOR_PASSWORD || DEV_PASSWORD)

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function authenticateOperator(password: string): boolean {
  if (!operatorEnabled) return false
  if (OPERATOR_HASH) return verifySecret(password, OPERATOR_HASH)
  return safeEqual(password, OPERATOR_PASSWORD || DEV_PASSWORD)
}

const TOKEN_TTL = 12 * 3600
function sign(value: string): string {
  return createHmac('sha256', SECRET).update(value).digest('base64url')
}
export function makeOperatorToken(): string {
  const payload = `operator.${Math.floor(Date.now() / 1000) + TOKEN_TTL}`
  return `${payload}.${sign(payload)}`
}
export function verifyOperatorToken(token?: string): boolean {
  if (!operatorEnabled || !token) return false
  const [kind, exp, signature] = token.split('.')
  if (kind !== 'operator' || !exp || !signature || Number(exp) <= Date.now() / 1000) return false
  return safeEqual(signature, sign(`${kind}.${exp}`))
}

function registryEntries(): RegistryEntry[] {
  if (existsSync(REGISTRY_PATH)) {
    const parsed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as unknown
    if (!Array.isArray(parsed)) throw new Error('Operator-Registry muss ein JSON-Array sein')
    return parsed.filter((entry): entry is RegistryEntry => Boolean(entry && typeof entry === 'object' && 'slug' in entry && 'schoolName' in entry))
  }
  if (!existsSync(DATA_DIR)) return []
  return readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.db'))
    .map((name) => {
      const slug = name.slice(0, -3)
      let schoolName = slug
      try { schoolName = board.getConfig(openTenant(slug), 'school_name') || slug } catch { /* surfaced as status error later */ }
      return { slug, schoolName }
    })
}

export function recordUsage(db: Database.Database, kind: 'app_open' | 'activity', boardHash?: string): void {
  db.prepare('INSERT INTO usage_events (kind, board_hash) VALUES (?, ?)').run(kind, boardHash || null)
}

const metricCache = new Map<string, { until: number; value: UsageMetrics }>()
export function collectUsage(db: Database.Database, slug: string, now = new Date()): UsageMetrics {
  const cached = metricCache.get(slug)
  if (cached && cached.until > now.getTime()) return cached.value
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const row = db.prepare(`SELECT
    COUNT(DISTINCT CASE WHEN kind = 'app_open' THEN board_hash END) activeBoards7d,
    SUM(CASE WHEN kind = 'activity' THEN 1 ELSE 0 END) activities7d,
    MAX(occurred_at) lastActivity
    FROM usage_events WHERE occurred_at >= ?`).get(since) as { activeBoards7d: number; activities7d: number | null; lastActivity: string | null }
  const value = { activeBoards7d: row.activeBoards7d, activities7d: row.activities7d || 0, lastActivity: row.lastActivity }
  metricCache.set(slug, { until: now.getTime() + CACHE_MS, value })
  return value
}

export function deriveStatus(entry: RegistryEntry, metrics: UsageMetrics, dbError = false, now = new Date()): { status: InstanceStatus; reason: string } {
  if (dbError) return { status: 'error', reason: 'Datenbank nicht erreichbar' }
  if (entry.onboarding) return { status: 'onboarding', reason: 'Einrichtung läuft' }
  if (entry.backup?.status === 'failed') return { status: 'attention', reason: 'Backup fehlgeschlagen' }
  if (metrics.lastActivity && now.getTime() - new Date(metrics.lastActivity).getTime() > 14 * 86_400_000)
    return { status: 'attention', reason: 'Lange ohne Aktivität' }
  return { status: 'active', reason: entry.maintenance ? 'Wartungsmodus' : 'Läuft stabil' }
}

export function platformSnapshot(now = new Date()) {
  const instances: InstanceSnapshot[] = registryEntries().map((entry) => {
    let metrics: UsageMetrics = { activeBoards7d: 0, activities7d: 0, lastActivity: null }
    let dbError = false
    try { metrics = collectUsage(openTenant(entry.slug), entry.slug, now) } catch { dbError = !entry.onboarding }
    const derived = deriveStatus(entry, metrics, dbError, now)
    return { ...entry, ...metrics, subdomain: `${entry.slug}.${BASE_DOMAIN}`, status: derived.status, statusReason: derived.reason }
  })
  const versions = Object.entries(instances.reduce<Record<string, number>>((all, item) => {
    const version = item.version || VERSION
    all[version] = (all[version] || 0) + 1
    return all
  }, {})).map(([version, count]) => ({ version, count }))
  const backups = instances.filter((item) => item.backup?.at).sort((a, b) => String(b.backup?.at).localeCompare(String(a.backup?.at)))
  const certificates = instances.map((item) => item.certificateExpiresAt).filter((date): date is string => Boolean(date)).sort()
  return {
    instances,
    kpis: {
      instances: instances.length,
      activeBoards7d: instances.reduce((sum, item) => sum + item.activeBoards7d, 0),
      activities7d: instances.reduce((sum, item) => sum + item.activities7d, 0),
    },
    platform: { versions, lastBackup: backups[0]?.backup?.at || null, certificateExpiresAt: certificates[0] || null },
  }
}

export function setMaintenance(slug: string, maintenance: boolean): void {
  if (!existsSync(REGISTRY_PATH)) throw new Error('Wartungsmodus benötigt eine Instanz-Registry')
  const entries = registryEntries()
  const entry = entries.find((item) => item.slug === slug)
  if (!entry) throw new Error('Instanz nicht gefunden')
  entry.maintenance = maintenance
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 })
}

export function backupLog(slug: string): string {
  const file = path.join(process.env.RAUMBOARD_BACKUP_LOG_DIR || path.join(DATA_DIR, 'backup-logs'), `${slug}.log`)
  return existsSync(file) ? readFileSync(file, 'utf8').slice(-20_000) : 'Noch kein Backup-Protokoll vorhanden.'
}

export function dbModifiedAt(slug: string): string | null {
  try { return statSync(dbPath(slug)).mtime.toISOString() } catch { return null }
}
