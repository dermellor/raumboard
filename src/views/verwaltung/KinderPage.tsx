import { ChevronDown, FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import type { Klass } from '../../types'
import { EmojiButton } from '../../EmojiButton'
import { Modal } from '../../components'
import { PasswordGate } from '../../PasswordGate'
import { Symbol } from '../../Symbol'
import { addKid, addKlass, removeKid, removeKlass, updateKid, updateKlass } from '../../store'
import { useBoard, useMeta } from '../../useBoard'
import { NameField } from './editing'

// SheetJS is heavy and only needed for the (rare) import — load it on demand
// so the boards running all day on whiteboards stay light.
const ImportWizard = lazy(() =>
  import('../../import/ImportWizard').then((m) => ({ default: m.ImportWizard })),
)

/**
 * Classes and kids, one table per class: the bandarole carries the class
 * (symbol, name, pencil for the editing modal, kid count) and the table
 * under it carries its own column titles and the „Kind hinzufügen" button.
 * The bandarole is collapsed by default, so the page reads as a class list
 * and opens into a roster on demand. The import lives here too, as the
 * button at the foot, because it replaces exactly what this page shows.
 */
export function KinderPage() {
  const state = useBoard()
  const meta = useMeta()
  const [klassModal, setKlassModal] = useState(false)
  const [klassName, setKlassName] = useState('')
  const [klassEmoji, setKlassEmoji] = useState('🚪')
  // the class being edited in the modal, plus the draft fields it saves
  const [editKlass, setEditKlass] = useState<Klass | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [kidModal, setKidModal] = useState(false)
  const [kidName, setKidName] = useState('')
  const [kidSymbol, setKidSymbol] = useState('⭐')
  const [kidKlass, setKidKlass] = useState('')
  // the import asks for the school's password on every click: it happens
  // about once a year, and a 30-day session cookie may not be what replaces
  // the data of the whole school
  const [gateOpen, setGateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const openEdit = (c: Klass) => {
    setEditKlass(c)
    setEditName(c.name)
    setEditEmoji(c.emoji ?? '')
  }

  return (
    <section>
      <button onClick={() => setKlassModal(true)}>
        <Plus /> Klasse hinzufügen
      </button>

      {state.klasses.map((c) => {
        const kids = state.kids.filter((k) => k.klassId === c.id)
        return (
          <details key={c.id} className="klass">
                {/* the bandarole is the class editor: clicking a control must
                    not expand or collapse, so those clicks do not toggle */}
                <summary
                  className="klass-bandarole"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, input')) e.preventDefault()
                  }}
                >
                  <ChevronDown className="chevron" />
                  <Symbol className="emoji" value={c.emoji || '🚪'} />
                  <span className="klass-name">Klasse {c.name}</span>
                  <button
                    className="edit"
                    aria-label={`Klasse ${c.name} bearbeiten`}
                    onClick={() => openEdit(c)}
                  >
                    <Pencil />
                  </button>
                  <span className="count">
                    {kids.length} {kids.length === 1 ? 'Kind' : 'Kinder'}
                  </span>
                </summary>
                <table>
                  <thead>
                    <tr>
                      <th>Kind</th><th>Klasse</th>
                      <th className="th-add">
                        <button
                          className="add"
                          aria-label={`Kind in Klasse ${c.name} hinzufügen`}
                          onClick={() => {
                            setKidKlass(c.id)
                            setKidModal(true)
                          }}
                        >
                          <Plus />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {kids.map((k) => (
                      <tr key={k.id}>
                        <td>
                          <EmojiButton
                            value={k.symbol}
                            label={`Symbol für ${k.name}`}
                            onChange={(symbol) => updateKid(k.id, { symbol })}
                          />{' '}
                          <NameField
                            value={k.name}
                            label={`Name von ${k.name}`}
                            onCommit={(name) => updateKid(k.id, { name })}
                          />
                        </td>
                        <td>
                          <select
                            value={k.klassId}
                            onChange={(e) => updateKid(k.id, { klassId: e.target.value })}
                          >
                            {state.klasses.map((c2) => (
                              <option key={c2.id} value={c2.id}>Klasse {c2.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="td-right">
                          <button
                            className="add danger"
                            aria-label={`${k.name} löschen`}
                            onClick={() => {
                              if (confirm(`${k.name} löschen?`)) removeKid(k.id)
                            }}
                          >
                            <Trash2 />
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
        onClick={() => (meta.mode === 'api' ? setGateOpen(true) : setImportOpen(true))}
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

      {klassModal && (
        <Modal title="Klasse hinzufügen" onClose={() => setKlassModal(false)}>
          <div className="field">
            <label>Symbol</label>
            <EmojiButton value={klassEmoji} label="Emoji für neue Klasse" onChange={setKlassEmoji} />
          </div>
          <div className="field">
            <label htmlFor="klass-name">Name</label>
            <input
              id="klass-name"
              placeholder="z.B. 1C"
              value={klassName}
              autoFocus
              onChange={(e) => setKlassName(e.target.value)}
            />
          </div>
          <button
            disabled={!klassName.trim()}
            onClick={() => {
              addKlass(klassName.trim(), klassEmoji || undefined)
              setKlassName('')
              setKlassModal(false)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}

      {editKlass && (
        <Modal title={`Klasse ${editKlass.name} bearbeiten`} onClose={() => setEditKlass(null)}>
          <div className="field">
            <label>Symbol</label>
            <EmojiButton
              value={editEmoji}
              label={`Emoji für Klasse ${editKlass.name}`}
              onChange={setEditEmoji}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-klass-name">Name</label>
            <input
              id="edit-klass-name"
              value={editName}
              autoFocus
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <button
            disabled={!editName.trim() || editName.trim() === editKlass.name && editEmoji === (editKlass.emoji ?? '')}
            onClick={() => {
              updateKlass(editKlass.id, { name: editName.trim(), emoji: editEmoji })
              setEditKlass(null)
            }}
          >
            speichern
          </button>
          {/* the number is in the question because this is the one
              deletion on the PIN level that takes children with it */}
          <button
            className="danger"
            onClick={() => {
              const kidCount = state.kids.filter((k) => k.klassId === editKlass.id).length
              if (
                confirm(
                  `Klasse ${editKlass.name} samt ${kidCount} ${kidCount === 1 ? 'Kind' : 'Kindern'} und klassengebundenen Räumen löschen?`,
                )
              ) {
                removeKlass(editKlass.id)
                setEditKlass(null)
              }
            }}
          >
            <Trash2 /> Klasse löschen
          </button>
        </Modal>
      )}

      {kidModal && (
        <Modal title="Kind hinzufügen" onClose={() => setKidModal(false)}>
          <div className="field">
            <label>Symbol</label>
            <EmojiButton value={kidSymbol} label="Symbol für neues Kind" onChange={setKidSymbol} />
          </div>
          <div className="field">
            <label htmlFor="kid-name">Name</label>
            <input
              id="kid-name"
              placeholder="z.B. Mina K."
              value={kidName}
              autoFocus
              onChange={(e) => setKidName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="kid-klass">Klasse</label>
            <select id="kid-klass" value={kidKlass} onChange={(e) => setKidKlass(e.target.value)}>
              <option value="">Klasse wählen…</option>
              {state.klasses.map((c) => (
                <option key={c.id} value={c.id}>Klasse {c.name}</option>
              ))}
            </select>
          </div>
          <button
            disabled={!kidName.trim() || !kidKlass}
            onClick={() => {
              addKid(kidKlass, kidSymbol || '⭐', kidName.trim())
              setKidName('')
              setKidModal(false)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}
    </section>
  )
}
