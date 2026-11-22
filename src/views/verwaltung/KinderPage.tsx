import { ChevronDown, FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { EmojiButton } from '../../EmojiButton'
import { PasswordGate } from '../../PasswordGate'
import { Symbol } from '../../Symbol'
import { Drawer } from '../../Drawer'
import { addKid, addKlass, removeKid, removeKlass, updateKid, updateKlass } from '../../store'
import { useBoard, useMeta } from '../../useBoard'
import { NameField } from './editing'

// SheetJS is heavy and only needed for the (rare) import — load it on demand
// so the boards running all day on whiteboards stay light.
const ImportWizard = lazy(() =>
  import('../../import/ImportWizard').then((m) => ({ default: m.ImportWizard })),
)

/** The kid in the drawer: fields commit immediately, like every drawer. A
 * teacher with the PIN sees the same drawer as an admin; only the class move
 * and the delete stay with the account. */
function KidDrawer({ kidId, onClose }: { kidId: string; onClose: () => void }) {
  const state = useBoard()
  const meta = useMeta()
  const kid = state.kids.find((k) => k.id === kidId)
  if (!kid) return null
  const klass = state.klasses.find((c) => c.id === kid.klassId)

  return (
    <Drawer
      title={
        <>
          <Symbol value={kid.symbol} /> {kid.name}
        </>
      }
      onClose={onClose}
      footer={
        meta.isAdmin && (
          <button
            className="add danger"
            onClick={() => {
              if (confirm(`${kid.name} löschen?`)) {
                removeKid(kid.id)
                onClose()
              }
            }}
        >
          <Trash2 /> Kind löschen
        </button>
        )
      }
    >
      <div className="field">
        <label>Symbol</label>
        <EmojiButton
          value={kid.symbol}
          label={`Symbol für ${kid.name}`}
          onChange={(symbol) => updateKid(kid.id, { symbol })}
        />
      </div>
      <div className="field">
        <label htmlFor={`kid-name-${kid.id}`}>Name</label>
        <NameField
          value={kid.name}
          label={`Name von ${kid.name}`}
          onCommit={(name) => updateKid(kid.id, { name })}
        />
      </div>
      <div className="field">
        <label htmlFor={`kid-klass-${kid.id}`}>Klasse</label>
        {/* moving a kid changes the roster, so unlike name and symbol it
            needs an account (see the narrow patch in server/index.ts) */}
        <select
          id={`kid-klass-${kid.id}`}
          value={kid.klassId}
          disabled={!meta.isAdmin}
          onChange={(e) => updateKid(kid.id, { klassId: e.target.value })}
        >
          {state.klasses.map((c) => (
            <option key={c.id} value={c.id}>Klasse {c.name}</option>
          ))}
        </select>
      </div>
      {klass && (
        <p className="hint">
          Ein Kind bucht nur Lernorte, die für seine Klasse freigegeben sind („Für" beim Raum).
        </p>
      )}
    </Drawer>
  )
}

/** The same drawer in create mode: preselects the class the table sits in. */
function NewKidDrawer({ klassId, onClose }: { klassId: string; onClose: () => void }) {
  const state = useBoard()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('⭐')
  const [klass, setKlass] = useState(klassId)

  return (
    <Drawer title="Kind hinzufügen" onClose={onClose}>
      <div className="field">
        <label>Symbol</label>
        <EmojiButton value={symbol} label="Symbol für neues Kind" onChange={setSymbol} />
      </div>
      <div className="field">
        <label htmlFor="kid-name-new">Name</label>
        <input
          id="kid-name-new"
          placeholder="z.B. Mina K."
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="kid-klass-new">Klasse</label>
        <select id="kid-klass-new" value={klass} onChange={(e) => setKlass(e.target.value)}>
          {state.klasses.map((c) => (
            <option key={c.id} value={c.id}>Klasse {c.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <button
          className="primary"
          disabled={!name.trim() || !klass}
          onClick={() => {
            addKid(klass, symbol || '⭐', name.trim())
            onClose()
          }}
        >
          anlegen
        </button>
      </div>
    </Drawer>
  )
}

/** The class in the drawer; its roster lives in the bandarole, not here. */
function KlassDrawer({ klassId, onClose }: { klassId: string; onClose: () => void }) {
  const state = useBoard()
  const meta = useMeta()
  const klass = state.klasses.find((c) => c.id === klassId)
  if (!klass) return null
  const kidCount = state.kids.filter((k) => k.klassId === klass.id).length

  return (
    <Drawer
      title={
        <>
          <Symbol value={klass.emoji || '🚪'} /> Klasse {klass.name}
        </>
      }
      onClose={onClose}
      footer={
        meta.isAdmin && (
          <button
            className="add danger"
            onClick={() => {
              // the number is in the question because this deletion takes
              // children with it — and it needs an account, like every write
              if (
                confirm(
                  `Klasse ${klass.name} samt ${kidCount} ${kidCount === 1 ? 'Kind' : 'Kindern'} und klassengebundenen Räumen löschen?`,
                )
              ) {
                removeKlass(klass.id)
                onClose()
              }
            }}
          >
            <Trash2 /> Klasse löschen
          </button>
        )
      }
    >
      <div className="field">
        <label>Symbol</label>
        <EmojiButton
          value={klass.emoji ?? ''}
          label={`Emoji für Klasse ${klass.name}`}
          onChange={(emoji) => updateKlass(klass.id, { emoji })}
        />
      </div>
      <div className="field">
        <label htmlFor={`klass-name-${klass.id}`}>Name</label>
        <NameField
          value={klass.name}
          label={`Name von Klasse ${klass.name}`}
          onCommit={(name) => updateKlass(klass.id, { name })}
        />
      </div>
      <p className="hint">
        {kidCount} {kidCount === 1 ? 'Kind' : 'Kinder'} in dieser Klasse; die Liste steht
        unter der Klassenleiste auf der Seite.
      </p>
    </Drawer>
  )
}

/** The same drawer in create mode. */
function NewKlassDrawer({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🚪')

  return (
    <Drawer title="Klasse hinzufügen" onClose={onClose}>
      <div className="field">
        <label>Symbol</label>
        <EmojiButton value={emoji} label="Emoji für neue Klasse" onChange={setEmoji} />
      </div>
      <div className="field">
        <label htmlFor="klass-name-new">Name</label>
        <input
          id="klass-name-new"
          placeholder="z.B. 1C"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <button
          className="primary"
          disabled={!name.trim()}
          onClick={() => {
            addKlass(name.trim(), emoji || undefined)
            setName('')
            onClose()
          }}
        >
          anlegen
        </button>
      </div>
    </Drawer>
  )
}

/**
 * Classes and kids, one table per class: the bandarole carries the class
 * (symbol, name, pencil for the drawer, kid count) and the table under it
 * reads as a roster (symbol, name, class — plain text, editing through the
 * pencil's drawer). The bandarole is collapsed by default, so the page reads
 * as a class list and opens into a roster on demand. The import lives here
 * too, as the button at the foot, because it replaces exactly what this page
 * shows.
 */
export function KinderPage() {
  const state = useBoard()
  const meta = useMeta()
  const [newKlass, setNewKlass] = useState(false)
  const [editKlass, setEditKlass] = useState<string | null>(null)
  const [newKid, setNewKid] = useState<string | null>(null)
  const [editKid, setEditKid] = useState<string | null>(null)
  // the import asks for the school's password on every click: it happens
  // about once a year, and a 30-day session cookie may not be what replaces
  // the data of the whole school
  const [gateOpen, setGateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  return (
    <section>
      {/* creating classes and kids edits the roster, so it needs a signed-in
          account; a teacher with the PIN only fixes a kid's name and symbol */}
      {meta.isAdmin && (
        <button onClick={() => setNewKlass(true)}>
          <Plus /> Klasse hinzufügen
        </button>
      )}

      {state.klasses.map((c) => {
        const kids = state.kids.filter((k) => k.klassId === c.id)
        return (
          <details key={c.id} className="klass">
                {/* the bandarole is the class header: clicking the pencil must
                    not expand or collapse, so its click does not toggle */}
                <summary
                  className="klass-bandarole"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) e.preventDefault()
                  }}
                >
                  <ChevronDown className="chevron" />
                  <Symbol className="emoji" value={c.emoji || '🚪'} />
                  <span className="klass-name">Klasse {c.name}</span>
                  {meta.isAdmin && (
                    <button
                      className="edit"
                      aria-label={`Klasse ${c.name} bearbeiten`}
                      onClick={() => setEditKlass(c.id)}
                    >
                      <Pencil />
                    </button>
                  )}
                  <span className="count">
                    {kids.length} {kids.length === 1 ? 'Kind' : 'Kinder'}
                  </span>
                </summary>
                <table>
                  <thead>
                    <tr>
                      {/* the third header cell always exists: teachers see
                          the kid pencils too, and a missing cell would end the
                          header line one column early */}
                      <th>Kind</th><th>Klasse</th>
                      <th className="th-add">
                        {meta.isAdmin && (
                          <button
                            className="add"
                            aria-label={`Kind in Klasse ${c.name} hinzufügen`}
                            onClick={() => setNewKid(c.id)}
                          >
                            <Plus />
                          </button>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {kids.map((k) => (
                      <tr key={k.id}>
                        <td className="cell-name">
                          <div className="cell-name-inner">
                            <Symbol className="emoji" value={k.symbol} />
                            <span className="kid-name">{k.name}</span>
                          </div>
                        </td>
                        <td>Klasse {c.name}</td>
                        {/* the pencil is the teacher's daily fix: name and symbol
                            stay on the PIN, the class move inside needs an account */}
                        <td className="td-edit">
                          <button
                            className="row-edit"
                            aria-label={`${k.name} bearbeiten`}
                            onClick={() => setEditKid(k.id)}
                          >
                            <Pencil />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )
          })}

      <hr className="section-rule" />
      <button
        onClick={() => (meta.mode === 'api' && !meta.devOpen ? setGateOpen(true) : setImportOpen(true))}
      >
        <FileUp /> Kinder aus Excel/CSV importieren
      </button>

      {gateOpen && (
        <PasswordGate
          onSuccess={() => {
            setGateOpen(false)
            setImportOpen(true)
          }}
          onClose={() => setGateOpen(false)}
        />
      )}
      {importOpen && (
        <Suspense fallback={null}>
          <ImportWizard onClose={() => setImportOpen(false)} />
        </Suspense>
      )}

      {newKlass && <NewKlassDrawer onClose={() => setNewKlass(false)} />}
      {editKlass && <KlassDrawer klassId={editKlass} onClose={() => setEditKlass(null)} />}
      {newKid && <NewKidDrawer klassId={newKid} onClose={() => setNewKid(null)} />}
      {editKid && <KidDrawer kidId={editKid} onClose={() => setEditKid(null)} />}
    </section>
  )
}
