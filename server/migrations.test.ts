// These run against real SQLite files in a temp directory, because the parts worth
// testing here (adoption of an existing database, the downgrade refusal, one
// transaction per file) only exist in the interaction with the store. Fixtures use
// their own migration directory, so a test can never write into the real one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate, migrationFiles, parseMigrationName, validateMigrationNames } from './migrations'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** A throwaway migration directory plus a throwaway database path. */
function fixture(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'lb-mig-'))
  const dir = path.join(root, 'migrations')
  mkdirSync(dir)
  for (const [name, sql] of Object.entries(files)) writeFileSync(path.join(dir, name), sql)
  return { dir, db: (n = 't.db') => path.join(root, n), cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const INIT = 'CREATE TABLE klasses (id TEXT PRIMARY KEY, name TEXT NOT NULL);\n'
const applied = (db: Database.Database) =>
  (db.prepare('select name from schema_migrations order by name').all() as { name: string }[]).map((r) => r.name)

test('a fresh database gets every migration and the compatibility marker', () => {
  const f = fixture({ '0001_init.sql': INIT })
  try {
    const db = new Database(f.db())
    migrate(db, 'fresh', f.dir)
    assert.deepEqual(applied(db), ['0001_init.sql'])
    assert.equal(db.pragma('user_version', { simple: true }), 1)
    db.close()
  } finally { f.cleanup() }
})

test('an existing database is adopted, not re-run, and keeps its data', () => {
  // The shape left by the previous scheme: schema applied, user_version = 1, no
  // tracking table. Re-running 0001 would fail against tables that already exist.
  const f = fixture({ '0001_init.sql': INIT })
  try {
    const p = f.db('legacy.db')
    const seed = new Database(p)
    seed.exec(INIT)
    seed.pragma('user_version = 1')
    seed.prepare("insert into klasses (id, name) values ('k1', 'Klasse 1')").run()
    seed.close()

    const db = new Database(p)
    migrate(db, 'legacy', f.dir)
    assert.deepEqual(applied(db), ['0001_init.sql'])
    assert.equal((db.prepare('select count(*) as n from klasses').get() as { n: number }).n, 1)
    db.close()
  } finally { f.cleanup() }
})

test('a later migration is applied on the next open', () => {
  const f = fixture({ '0001_init.sql': INIT, '0002_add_emoji.sql': 'ALTER TABLE klasses ADD COLUMN emoji TEXT;\n' })
  try {
    const db = new Database(f.db())
    migrate(db, 't', f.dir)
    assert.deepEqual(applied(db), ['0001_init.sql', '0002_add_emoji.sql'])
    const cols = (db.prepare('pragma table_info(klasses)').all() as { name: string }[]).map((c) => c.name)
    assert.ok(cols.includes('emoji'))
    db.close()
  } finally { f.cleanup() }
})

test('repeating migrate changes nothing', () => {
  const f = fixture({ '0001_init.sql': INIT })
  try {
    const db = new Database(f.db())
    migrate(db, 't', f.dir)
    migrate(db, 't', f.dir)
    migrate(db, 't', f.dir)
    assert.deepEqual(applied(db), ['0001_init.sql'])
    db.close()
  } finally { f.cleanup() }
})

test('a database newer than the code is refused instead of served', () => {
  const f = fixture({ '0001_init.sql': INIT, '0002_later.sql': 'ALTER TABLE klasses ADD COLUMN note TEXT;\n' })
  try {
    const p = f.db()
    const db = new Database(p)
    migrate(db, 't', f.dir)
    db.close()

    // Same database, but this build no longer carries 0002: a rollback.
    const older = fixture({ '0001_init.sql': INIT })
    try {
      const re = new Database(p)
      assert.throws(() => migrate(re, 'rolled-back', older.dir), /NEWER than this code/)
      re.close()
    } finally { older.cleanup() }
  } finally { f.cleanup() }
})

test('a failing migration leaves neither schema change nor tracking row', () => {
  const f = fixture({ '0001_init.sql': INIT, '0002_broken.sql': 'ALTER TABLE klasses ADD COLUMN ok TEXT;\nSELECT this_is_not_valid();\n' })
  try {
    const db = new Database(f.db())
    assert.throws(() => migrate(db, 't', f.dir))
    assert.deepEqual(applied(db), ['0001_init.sql'], '0002 must not be recorded')
    const cols = (db.prepare('pragma table_info(klasses)').all() as { name: string }[]).map((c) => c.name)
    assert.ok(!cols.includes('ok'), 'the half of 0002 that succeeded must be rolled back')
    db.close()
  } finally { f.cleanup() }
})

test('a misnamed migration is refused before anything is touched', () => {
  const f = fixture({ '1_init.sql': INIT })
  try {
    const db = new Database(f.db())
    assert.throws(() => migrate(db, 't', f.dir), /must be NNNN_lower_snake_case/)
    db.close()
  } finally { f.cleanup() }
})

test('a duplicate number is refused, because filename order is apply order', () => {
  const f = fixture({ '0001_init.sql': INIT, '0001_also_init.sql': 'select 1;\n' })
  try {
    const db = new Database(f.db())
    assert.throws(() => migrate(db, 't', f.dir), /0001 used 2×/)
    db.close()
  } finally { f.cleanup() }
})

test('parseMigrationName recognises the shape and the breaking marker', () => {
  assert.deepEqual(parseMigrationName('0002_add_note.sql'), { num: 2, breaking: false })
  assert.equal(parseMigrationName('0003_drop_note_breaking.sql')?.breaking, true)
  assert.equal(parseMigrationName('0003-add-note.sql'), null)
})

test('gaps in the numbering are allowed', () => {
  assert.deepEqual(validateMigrationNames(['0001_init.sql', '0007_later.sql']), [])
})

test("the repository's own migration set is well-formed", () => {
  // Regression guard on the real filenames: a rename that breaks the convention
  // fails here rather than when a school's database is opened.
  const files = migrationFiles(path.join(HERE, 'migrations'))
  assert.ok(files.length > 0, 'expected at least one migration file')
  assert.deepEqual(validateMigrationNames(files), [])
})

test('a legacy single-class scope becomes a one-element list', () => {
  // The shape a school's database had before the scope list: 0001 applied
  // (user_version = 1), rooms carrying a bare klassId in scope. Adoption marks
  // 0001 as applied, 0002 and 0003 run against the existing rows.
  const root = mkdtempSync(path.join(tmpdir(), 'lb-scope-'))
  try {
    const p = path.join(root, 'legacy-scope.db')
    const seed = new Database(p)
    seed.exec(readFileSync(path.join(HERE, 'migrations/0001_init.sql'), 'utf8'))
    seed.pragma('user_version = 1')
    seed.prepare("insert into klasses (id, name) values ('1a', '1A')").run()
    seed.prepare(
      "insert into rooms (id, name, emoji, capacity, is_open, scope) values ('r1', 'Flur', '🧩', 3, 1, '1a')",
    ).run()
    seed.prepare(
      "insert into rooms (id, name, emoji, capacity, is_open, scope) values ('r2', 'Hof', '🌳', 3, 1, 'all')",
    ).run()
    seed.close()

    const db = new Database(p)
    migrate(db, 'legacy-scope', path.join(HERE, 'migrations'))
    const scopes = Object.fromEntries(
      (db.prepare('select id, scope from rooms').all() as { id: string; scope: string }[]).map((r) => [
        r.id,
        r.scope,
      ]),
    )
    assert.equal(scopes['r1'], '["1a"]')
    assert.equal(scopes['r2'], 'all')
    db.close()
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
