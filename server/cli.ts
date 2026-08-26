#!/usr/bin/env tsx
/**
 * Tenant administration CLI (run on the server, credentials print to stdout only):
 *
 *   tsx server/cli.ts create-school <slug> "<Schulname>" <admin-email> [--seed]
 *   tsx server/cli.ts reset-credentials <slug>
 *   tsx server/cli.ts add-account <slug> <email> [--owner]
 *   tsx server/cli.ts list
 *
 * A school has several admin accounts now (see AGENTS.md „Auth"). `create-school`
 * makes the first one an owner; owners add the rest in the Verwaltung, and
 * `add-account` is the operator's fallback for recovery.
 */
import { readdirSync } from 'node:fs'
import { buildSeed } from '../src/seed'
import { generatePassword, generatePin, hashSecret } from './auth'
import * as board from './board'
import { DATA_DIR, openTenant, tenantExists } from './tenant'

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
    board.createUser(db, email.toLowerCase(), hashSecret(password), 'owner')
    board.setConfig(db, 'pin_hash', hashSecret(pin))
    board.setConfig(db, 'pin_length', String(pin.length))
    if (seedFlag) board.replaceAll(db, buildSeed())
    console.log(`Mandant angelegt: ${slug} (${name})`)
    console.log(`  Inhaber:  ${email.toLowerCase()}`)
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
    // reset the PIN, and the password of the first owner (the account the
    // operator handed over at setup); other accounts stay as they are
    const owner = board.listUsers(db).find((u) => u.role === 'owner' && u.active)
    if (!owner) {
      console.error(`Mandant ${slug} hat kein aktives Inhaber-Konto — mit add-account eines anlegen`)
      process.exit(1)
    }
    const password = generatePassword()
    const pin = generatePin()
    board.setUserPassword(db, owner.id, hashSecret(password))
    board.setConfig(db, 'pin_hash', hashSecret(pin))
    board.setConfig(db, 'pin_length', String(pin.length))
    console.log(`Neue Zugangsdaten für ${slug}:`)
    console.log(`  Inhaber:  ${owner.email}`)
    console.log(`  Passwort: ${password}`)
    console.log(`  Lehrkraft-PIN: ${pin}`)
    break
  }
  case 'add-account': {
    const ownerFlag = args.includes('--owner')
    const [slug, email] = args.filter((a) => a !== '--owner')
    if (!slug || !email || !tenantExists(slug)) {
      console.error('usage: cli.ts add-account <slug> <email> [--owner] (Mandant muss existieren)')
      process.exit(1)
    }
    const db = openTenant(slug)
    const password = generatePassword()
    try {
      board.createUser(db, email.toLowerCase(), hashSecret(password), ownerFlag ? 'owner' : 'admin')
    } catch {
      console.error(`Für ${email.toLowerCase()} gibt es in ${slug} bereits ein Konto`)
      process.exit(1)
    }
    console.log(`Konto angelegt in ${slug}:`)
    console.log(`  ${ownerFlag ? 'Inhaber' : 'Admin'}:  ${email.toLowerCase()}`)
    console.log(`  Passwort: ${password}`)
    break
  }
  case 'list': {
    for (const f of readdirSync(DATA_DIR).filter((f) => f.endsWith('.db'))) {
      const slug = f.replace(/\.db$/, '')
      const db = openTenant(slug)
      const accounts = board.listUsers(db)
      const owner = accounts.find((u) => u.role === 'owner' && u.active)
      console.log(
        `${slug}: ${board.getConfig(db, 'school_name') ?? '?'} ` +
          `(${owner?.email ?? 'kein Inhaber'}, ${accounts.length} Konten)`,
      )
    }
    break
  }
  default:
    console.error('commands: create-school | reset-credentials | add-account | list')
    process.exit(1)
}
