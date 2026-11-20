// One-off for the cockpit preview only: pin a known teacher PIN onto a
// *copy* of a school's database so the acceptance preview can be unlocked.
// Never run against a production instance — reset-credentials in cli.ts is
// the real path for a school that forgot its PIN.
import Database from 'better-sqlite3'
import { hashSecret } from '../server/auth'

const [slug, pin] = process.argv.slice(2)
if (!slug || !pin || !/^\d{4,8}$/.test(pin)) {
  console.error('usage: tsx scripts/set-preview-pin.ts <slug> <pin>')
  process.exit(1)
}
const dir = process.env.RAUMBOARD_DATA ?? 'data'
const db = new Database(`${dir}/${slug}.db`)
db.prepare("INSERT INTO config (key, value) VALUES ('pin_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
  .run(hashSecret(pin))
db.prepare("INSERT INTO config (key, value) VALUES ('pin_length', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
  .run(String(pin.length))
db.close()
console.log(`PIN gesetzt für ${slug} (${pin.length} Ziffern)`)
