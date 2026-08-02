import {
  Ban, Baby, CircleCheck, Database, Hash, KeyRound, LayoutGrid, LogOut, Plus,
  RotateCcw, School, Settings, Sprout, Trash2, Upload, Users,
} from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import {
  addKid, addKlass, addRoom, changePassword, changePin, logout, occupancy,
  removeKid, removeKlass, removeRoom, reseed, reset, updateKid, updateKlass, updateRoom,
} from '../store'
import { EmojiButton } from '../EmojiButton'
import { Modal } from '../components'
import { useBoard, useMeta } from '../useBoard'

// SheetJS is heavy and only needed for the (rare) admin import — load it on demand
// so the boards running all day on whiteboards stay light.
const ImportWizard = lazy(() =>
  import('../import/ImportWizard').then((m) => ({ default: m.ImportWizard })),
)
import { Login } from './Login'

type AdminModal = 'room' | 'klass' | 'kid' | null

const TABS = [
  { key: 'raeume', label: 'Räume', icon: <LayoutGrid /> },
  { key: 'klassen', label: 'Klassen', icon: <Users /> },
  { key: 'kinder', label: 'Kinder', icon: <Baby /> },
  { key: 'daten', label: 'Daten', icon: <Database /> },
  { key: 'zugang', label: 'Zugangsdaten', icon: <KeyRound /> },
] as const
type TabKey = (typeof TABS)[number]['key']

function CredentialsSection() {
  const [modal, setModal] = useState<'password' | 'pin' | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const close = () => {
    setModal(null)
    setCurrent('')
    setNext('')
    setRepeat('')
    setPin('')
    setError(null)
  }

  const submitPassword = async () => {
    if (next.length < 10) return setError('Neues Passwort braucht mindestens 10 Zeichen.')
    if (next !== repeat) return setError('Die Wiederholung stimmt nicht überein.')
    const result = await changePassword(current, next)
    if (!result.ok) return setError(result.reason)
    close()
    setNotice('Passwort geändert.')
  }

  const submitPin = async () => {
    if (!/^\d{4,8}$/.test(pin.trim())) return setError('Die PIN muss aus 4–8 Ziffern bestehen.')
    const result = await changePin(current, pin.trim())
    if (!result.ok) return setError(result.reason)
    close()
    setNotice('Lehrkraft-PIN geändert. Bereits entsperrte Geräte bleiben entsperrt.')
  }

  return (
    <section>
      <button onClick={() => { setNotice(null); setModal('password') }}>
        <KeyRound /> Passwort ändern
      </button>{' '}
      <button onClick={() => { setNotice(null); setModal('pin') }}>
        <Hash /> Lehrkraft-PIN ändern
      </button>
      {notice && <p className="count">{notice}</p>}

      {modal === 'password' && (
        <Modal title="Passwort ändern" onClose={close}>
          <div className="field">
            <label htmlFor="cred-current">Aktuelles Passwort</label>
            <input
              id="cred-current" type="password" autoFocus autoComplete="current-password"
              value={current} onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cred-next">Neues Passwort</label>
            <input
              id="cred-next" type="password" autoComplete="new-password"
              value={next} onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cred-repeat">Wiederholen</label>
            <input
              id="cred-repeat" type="password" autoComplete="new-password"
              value={repeat} onChange={(e) => setRepeat(e.target.value)}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button disabled={!current || !next || !repeat} onClick={() => void submitPassword()}>
            speichern
          </button>
        </Modal>
      )}

      {modal === 'pin' && (
        <Modal title="Lehrkraft-PIN ändern" onClose={close}>
          <div className="field">
            <label htmlFor="cred-pw">Admin-Passwort</label>
            <input
              id="cred-pw" type="password" autoFocus autoComplete="current-password"
              value={current} onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cred-pin">Neue PIN</label>
            <input
              id="cred-pin" inputMode="numeric" pattern="[0-9]*" placeholder="4–8 Ziffern"
              value={pin} onChange={(e) => setPin(e.target.value)}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button disabled={!current || !pin} onClick={() => void submitPin()}>
            speichern
          </button>
        </Modal>
      )}
    </section>
  )
}

export function Admin() {
  const state = useBoard()
  const meta = useMeta()
  const [modal, setModal] = useState<AdminModal>(null)
  const [tab, setTab] = useState<TabKey>('raeume')
  const [importOpen, setImportOpen] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomEmoji, setRoomEmoji] = useState('🚪')
  const [roomCapacity, setRoomCapacity] = useState(4)
  const [roomScope, setRoomScope] = useState('all')
  const [kidName, setKidName] = useState('')
  const [kidSymbol, setKidSymbol] = useState('⭐')
  const [kidKlass, setKidKlass] = useState('')
  const [klassName, setKlassName] = useState('')
  const [klassEmoji, setKlassEmoji] = useState('🚪')

  if (meta.mode === 'api' && !meta.isAdmin) return <Login />

  return (
    <main className="admin">
      <div className="topbar">
        <a href="#/">
          <School className="icon-accent" /> Start
        </a>
        <h1>
          <Settings className="icon-h1" /> Verwaltung
        </h1>
        {meta.mode === 'api' && (
          <button className="logout" onClick={() => void logout()}>
            <LogOut /> Abmelden
          </button>
        )}
      </div>

      <nav className="tabbar">
        {TABS.filter((t) => t.key !== 'zugang' || meta.mode === 'api').map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {tab === 'daten' && (
      <section>
        <button onClick={() => setImportOpen(true)}>
          <Upload /> Kinder aus Excel/CSV importieren
        </button>
        <hr className="section-rule" />
        <button
          className="danger"
          onClick={() => {
            if (confirm('Alle Kinder zurück in ihre Klassenzimmer buchen?')) reset()
          }}
        >
          <RotateCcw /> Alle zurück in die Klasse (Reset)
        </button>{' '}
        {meta.mode === 'demo' && (
          <button
            className="danger"
            onClick={() => {
              if (confirm('Alles verwerfen und die Beispieldaten neu laden?')) reseed()
            }}
          >
            <Sprout /> Beispieldaten neu laden
          </button>
        )}
        {meta.dev && (
          <button
            className="danger"
            title="Nur lokal: aktuelle Daten verwerfen und den Beispiel-Datensatz laden"
            onClick={() => {
              if (confirm('Bestehende Daten wirklich durch Beispieldaten ersetzen?')) reseed()
            }}
          >
            <Sprout /> Bestehende Daten durch Beispieldaten ersetzen (Dev)
          </button>
        )}
        {importOpen && (
          <Suspense fallback={null}>
            <ImportWizard onClose={() => setImportOpen(false)} />
          </Suspense>
        )}
      </section>
      )}

      {tab === 'zugang' && meta.mode === 'api' && <CredentialsSection />}

      {tab === 'raeume' && (
      <section>
        <table>
          <thead>
            <tr>
              <th>Raum</th><th>Kapazität</th><th>Belegt</th><th>Für</th><th>Status</th>
              <th className="th-add">
                <button className="add" aria-label="Raum hinzufügen" onClick={() => setModal('room')}>
                  <Plus />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.rooms.map((r) => (
              <tr key={r.id} className={r.isOpen ? undefined : 'closed'}>
                <td>
                  <EmojiButton
                    value={r.emoji}
                    label={`Emoji für ${r.name}`}
                    onChange={(emoji) => updateRoom(r.id, { emoji })}
                  />{' '}
                  {r.name}
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={r.capacity}
                    style={{ width: '4em' }}
                    onChange={(e) => updateRoom(r.id, { capacity: Math.max(0, Number(e.target.value)) })}
                  />
                </td>
                <td>{occupancy(r.id, state)}</td>
                <td>{r.scope === 'all' ? 'alle' : `Klasse ${state.klasses.find((c) => c.id === r.scope)?.name ?? r.scope}`}</td>
                <td>
                  <button className="toggle" onClick={() => updateRoom(r.id, { isOpen: !r.isOpen })}>
                    {r.isOpen ? (
                      <>
                        <Ban className="icon-amber" /> Schließen
                      </>
                    ) : (
                      <>
                        <CircleCheck className="icon-green" /> Öffnen
                      </>
                    )}
                  </button>
                </td>
                <td className="td-right">
                  <button
                    className="add danger"
                    aria-label={`Raum ${r.name} löschen`}
                    onClick={() => {
                      if (confirm(`Raum „${r.name}" löschen? Eingebuchte Kinder gehen zurück in die Klasse.`))
                        removeRoom(r.id)
                    }}
                  >
                    <Trash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      )}

      {tab === 'klassen' && (
      <section>
        <table>
          <thead>
            <tr>
              <th>Klasse</th><th>Kinder</th>
              <th className="th-add">
                <button className="add" aria-label="Klasse hinzufügen" onClick={() => setModal('klass')}>
                  <Plus />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.klasses.map((c) => (
              <tr key={c.id}>
                <td>
                  <EmojiButton
                    value={c.emoji ?? ''}
                    label={`Emoji für Klasse ${c.name}`}
                    onChange={(emoji) => updateKlass(c.id, { emoji })}
                  />{' '}
                  Klasse {c.name}
                </td>
                <td>{state.kids.filter((k) => k.klassId === c.id).length}</td>
                <td className="td-right">
                  <button
                    className="add danger"
                    aria-label={`Klasse ${c.name} löschen`}
                    onClick={() => {
                      if (confirm(`Klasse ${c.name} samt allen Kindern und klassengebundenen Räumen löschen?`))
                        removeKlass(c.id)
                    }}
                  >
                    <Trash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      )}

      {tab === 'kinder' && (
      <section>
        {state.klasses.map((c) => (
          <details key={c.id}>
            <summary>Klasse {c.name}</summary>
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
                        setModal('kid')
                      }}
                    >
                      <Plus />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.kids
                  .filter((k) => k.klassId === c.id)
                  .map((k) => (
                    <tr key={k.id}>
                      <td>
                        <EmojiButton
                          value={k.symbol}
                          label={`Symbol für ${k.name}`}
                          onChange={(symbol) => updateKid(k.id, { symbol })}
                        />{' '}
                        {k.name}
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
        ))}
      </section>
      )}

      {modal === 'room' && (
        <Modal title="Raum hinzufügen" onClose={() => setModal(null)}>
          <div className="field">
            <label>Symbol</label>
            <EmojiButton value={roomEmoji} label="Emoji für neuen Raum" onChange={setRoomEmoji} />
          </div>
          <div className="field">
            <label htmlFor="room-name">Name</label>
            <input
              id="room-name"
              placeholder="z.B. Leseecke"
              value={roomName}
              autoFocus
              onChange={(e) => setRoomName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="room-capacity">Kapazität</label>
            <input
              id="room-capacity"
              type="number"
              min={0}
              value={roomCapacity}
              style={{ width: '5em' }}
              onChange={(e) => setRoomCapacity(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="field">
            <label htmlFor="room-scope">Für</label>
            <select id="room-scope" value={roomScope} onChange={(e) => setRoomScope(e.target.value)}>
              <option value="all">für alle</option>
              {state.klasses.map((c) => (
                <option key={c.id} value={c.id}>nur Klasse {c.name}</option>
              ))}
            </select>
          </div>
          <button
            disabled={!roomName.trim()}
            onClick={() => {
              addRoom(roomName.trim(), roomEmoji || '🚪', roomCapacity, roomScope)
              setRoomName('')
              setModal(null)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}

      {modal === 'klass' && (
        <Modal title="Klasse hinzufügen" onClose={() => setModal(null)}>
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
              setModal(null)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}

      {modal === 'kid' && (
        <Modal title="Kind hinzufügen" onClose={() => setModal(null)}>
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
              setModal(null)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}
    </main>
  )
}
