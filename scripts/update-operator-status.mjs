#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [slug, status, ...messageParts] = process.argv.slice(2)
if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug || '') || !['ok', 'failed', 'running'].includes(status || '')) process.exit(2)
const data = process.env.RAUMBOARD_DATA || process.env.BACKUP_DATA || '/opt/raumboard/data'
const registry = process.env.RAUMBOARD_OPERATOR_REGISTRY || path.join(data, 'operator-instances.json')
const logDir = process.env.RAUMBOARD_BACKUP_LOG_DIR || path.join(data, 'backup-logs')
const at = new Date().toISOString()
const message = messageParts.join(' ') || status
mkdirSync(logDir, { recursive: true })
appendFileSync(path.join(logDir, `${slug}.log`), `${at} ${status.toUpperCase()} ${message}\n`, { mode: 0o600 })
if (!existsSync(registry)) process.exit(0)
const entries = JSON.parse(readFileSync(registry, 'utf8'))
const entry = Array.isArray(entries) ? entries.find((item) => item?.slug === slug) : null
if (!entry) process.exit(0)
entry.backup = { status, at, message }
writeFileSync(registry, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 })
