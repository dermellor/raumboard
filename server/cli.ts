#!/usr/bin/env tsx
/**
 * Tenant administration CLI (run on the server, credentials print to stdout only):
 *
 *   tsx server/cli.ts create-school <slug> "<Schulname>" <admin-email> [--seed]
 *   tsx server/cli.ts reset-credentials <slug>
 *   tsx server/cli.ts list
 */
import { randomBytes, randomInt } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { buildSeed } from '../src/seed'
import { hashSecret } from './auth'
import * as board from './board'
import { DATA_DIR, openTenant, tenantExists } from './tenant'

function generatePassword(): string {
  // readable, phone-dictatable: 4 blocks of 4 lowercase alnum
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const block = () =>
    Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join('')
  return `${block()}-${block()}-${block()}`
}

function generatePin(): string {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

const [cmd, ...args] = process.argv.slice(2)

switch (cmd) {
  case 'create-school': {
    const seedFlag = args.includes('--seed')
    const [slug, name, email] = args.filter((a) => a !== '--seed')
    if (!slug || !name || !email) {
      console.error('usage: cli.ts create-school <slug> "<Schulname>" <admin-email> [--seed]')
      process.exit(1)
    }
    if (tenantExists(slug)) {
      console.error(`Mandant ${slug} existiert bereits`)
      process.exit(1)
    }
    const db = openTenant(slug, { create: true })
    const password = generatePassword()
    const pin = generatePin()
    board.setConfig(db, 'school_name', name)
    board.setConfig(db, 'admin_email', email.toLowerCase())
    board.setConfig(db, 'admin_hash', hashSecret(password))
    board.setConfig(db, 'pin_hash', hashSecret(pin))
    if (seedFlag) board.replaceAll(db, buildSeed())
    console.log(`Mandant angelegt: ${slug} (${name})`)
    console.log(`  Login:    ${email.toLowerCase()}`)
    console.log(`  Passwort: ${password}`)
    console.log(`  Lehrkraft-PIN: ${pin}`)
    break
  }
  case 'reset-credentials': {
    const [slug] = args
    if (!slug || !tenantExists(slug)) {
      console.error('usage: cli.ts reset-credentials <slug> (Mandant muss existieren)')
      process.exit(1)
    }
    const db = openTenant(slug)
    const password = generatePassword()
    const pin = generatePin()
    board.setConfig(db, 'admin_hash', hashSecret(password))
    board.setConfig(db, 'pin_hash', hashSecret(pin))
    console.log(`Neue Zugangsdaten für ${slug}:`)
    console.log(`  Passwort: ${password}`)
    console.log(`  Lehrkraft-PIN: ${pin}`)
    break
  }
  case 'list': {
    for (const f of readdirSync(DATA_DIR).filter((f) => f.endsWith('.db'))) {
      const slug = f.replace(/\.db$/, '')
      const db = openTenant(slug)
      console.log(`${slug}: ${board.getConfig(db, 'school_name') ?? '?'} (${board.getConfig(db, 'admin_email') ?? 'kein Login'})`)
    }
    break
  }
  default:
    console.error('commands: create-school | reset-credentials | list')
    process.exit(1)
}
