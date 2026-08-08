// Schema migrations for a tenant database.
//
// Before this, `migrate()` knew exactly one step: an empty file got `schema.sql`
// and `user_version = 1`. Every later schema change would have sat there silently,
// because nothing looked for one. Now the schema is an ordered set of files with a
// tracking table, so a change ships by adding a file.
//
// **It applies automatically on open, and that is deliberate here** — the opposite
// of the Postgres side of the house, which only verifies and makes applying a
// separate command. The difference is ownership, not taste: this process owns these
// files exclusively, SQLite is a single writer, and a tenant database is created
// lazily the first time its school is served. There is no fixed list of databases
// to migrate ahead of time, so a "run the CLI first" gate would be an operator task
// per school, including schools that did not exist at deploy time.
//
// What auto-applying must not do is guess. Two rules keep it honest:
//   - **Downgrade is refused, loudly.** A file recording a migration this code does
//     not have means the code is older than the data (someone rolled back). Serving
//     it would write through a schema we misunderstand, so we throw instead.
//   - **One transaction per file, tracking row included**, so a failure leaves
//     neither a half-applied schema nor a row claiming success.
//
// Migrations are therefore plain SQL that must NOT contain BEGIN/COMMIT: this
// wraps them, and better-sqlite3 rejects a nested transaction.

import type Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(HERE, 'migrations')

/** The step `user_version = 1` stood for, before there was a tracking table. */
const LEGACY_FIRST = '0001_init.sql'

export function parseMigrationName(file: string): { num: number; breaking: boolean } | null {
  const m = file.match(/^(\d{4})_([a-z0-9_]+)\.sql$/)
  return m ? { num: Number(m[1]), breaking: m[2].endsWith('_breaking') } : null
}

/** The .sql files in apply order, which is filename order. */
export function migrationFiles(dir = MIGRATIONS_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/**
 * Filename order IS apply order, so an ambiguous set silently picks an order
 * nobody intended: two branches that each grab `0002_` merge cleanly in git and
 * then run in alphabetical order of their names. Checked on every open, which is
 * cheap and means a bad name cannot reach a school's database at all.
 *
 * Gaps are fine — renumbering to close one renames a file that live databases
 * already record as applied, which would then read as pending forever.
 */
export function validateMigrationNames(files: string[]): string[] {
  const problems: string[] = []
  const byNum = new Map<number, string[]>()
  for (const file of files) {
    const parsed = parseMigrationName(file)
    if (!parsed) {
      problems.push(`${file}: name must be NNNN_lower_snake_case.sql`)
      continue
    }
    byNum.set(parsed.num, [...(byNum.get(parsed.num) ?? []), file])
  }
  for (const [num, names] of [...byNum].sort((a, b) => a[0] - b[0])) {
    if (names.length > 1) {
      problems.push(`number ${String(num).padStart(4, '0')} used ${names.length}× (${names.join(', ')}) — renumber the newer file`)
    }
  }
  return problems
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

type AppliedRow = { name: string; checksum: string }

/**
 * Brings one tenant database up to date. Safe to call on every open: with nothing
 * pending it is two cheap reads.
 */
export function migrate(db: Database.Database, slug = '?', dir = MIGRATIONS_DIR): void {
  const files = migrationFiles(dir)
  const problems = validateMigrationNames(files)
  if (problems.length) {
    throw new Error(`migrations are misnamed, refusing to touch ${slug}:\n  - ${problems.join('\n  - ')}`)
  }

  db.exec(`
    create table if not exists schema_migrations (
      name       text primary key,
      checksum   text not null,
      applied_at text not null default (datetime('now'))
    )`)

  adoptLegacy(db, dir)

  const applied = db.prepare('select name, checksum from schema_migrations').all() as AppliedRow[]
  const appliedNames = new Set(applied.map((r) => r.name))

  // Downgrade guard. Checked before applying anything, because the right response
  // to "this database knows more than I do" is to touch nothing.
  const unknown = applied.filter((r) => !files.includes(r.name)).map((r) => r.name)
  if (unknown.length) {
    throw new Error(
      `tenant ${slug} is NEWER than this code: it records migration(s) that do not exist here ` +
        `(${unknown.join(', ')}). This build is older than the data — deploy the matching version ` +
        `instead of serving it, because writing through a schema we do not know corrupts it. ` +
        `Downgrading a schema is not supported.`,
    )
  }

  for (const file of files) {
    if (appliedNames.has(file)) continue
    const content = readFileSync(path.join(dir, file), 'utf8')
    if (parseMigrationName(file)?.breaking) {
      console.warn(`[migrate] ${slug}: applying ${file}, which is marked breaking (destructive)`)
    }
    // DDL and the tracking row in one transaction: a failure rolls back both, so the
    // next open retries from a clean state instead of skipping a half-applied file.
    db.transaction(() => {
      db.exec(content)
      db.prepare('insert into schema_migrations (name, checksum) values (?, ?)').run(file, sha256(content))
    })()
    console.log(`[migrate] ${slug}: applied ${file}`)
  }

  // Kept in step as a compatibility marker: a build from before the tracking table
  // decides with `user_version < 1`, and leaving it at 0 would make such a build
  // re-run 0001 against tables that already exist.
  if (files.length > 0) db.pragma('user_version = 1')
}

/**
 * Adopts a database migrated by the previous scheme. It carries the full
 * `schema.sql` and `user_version = 1`, but no tracking table — so without this,
 * `0001_init.sql` would read as pending and re-run against existing tables.
 * Recording it without executing it is the same move as a baseline, and it is safe
 * to do automatically here because `user_version = 1` had exactly one meaning.
 */
function adoptLegacy(db: Database.Database, dir: string): void {
  const tracked = db.prepare('select count(*) as n from schema_migrations').get() as { n: number }
  if (tracked.n > 0) return
  const version = db.pragma('user_version', { simple: true }) as number
  if (version < 1) return // genuinely fresh: let 0001 run normally

  const first = path.join(dir, LEGACY_FIRST)
  db.prepare('insert into schema_migrations (name, checksum) values (?, ?)').run(
    LEGACY_FIRST,
    sha256(readFileSync(first, 'utf8')),
  )
  console.log(`[migrate] adopted an existing database: recorded ${LEGACY_FIRST} as applied (not re-run)`)
}
