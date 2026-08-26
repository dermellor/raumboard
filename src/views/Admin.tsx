import {
  Ban, Baby, CircleCheck, FileUp, Hash, KeyRound, LayoutGrid, Lock, Plus,
  School, Settings, Sprout, Trash2, Upload, Users,
} from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import {
  addKid, addKlass, addRoom, changePassword, changePin, lockDevice, occupancy,
  removeKid, removeKlass, removeRoom, reseed, updateKid, updateKlass, updateRoom,
} from '../store'
import { EmojiButton } from '../EmojiButton'
import { Modal, TopBar } from '../components'
import { PasswordGate } from '../PasswordGate'
import { PinGate } from '../PinGate'
import { useBoard, useMeta } from '../useBoard'

// SheetJS is heavy and only needed for the (rare) import — load it on demand
// so the boards running all day on whiteboards stay light.
const ImportWizard = lazy(() =>
  import('../import/ImportWizard').then((m) => ({ default: m.ImportWizard })),
)

type AdminModal = 'room' | 'klass' | 'kid' | null

const TABS = [
  { key: 'raeume', label: 'Räume', icon: <LayoutGrid /> },
  { key: 'klassen', label: 'Klassen', icon: <Users /> },
  { key: 'kinder', label: 'Kinder', icon: <Baby /> },
  { key: 'import', label: 'Kinder importieren', icon: <Upload /> },
  { key: 'zugang', label: 'Zugangsdaten', icon: <KeyRound /> },
] as const
type TabKey = (typeof TABS)[number]['key']

/**
 * The two tabs that ask for the school's password before they open: one brings
 * personal data in from outside, the other holds the keys to the whole school.
 * The teacher PIN in front of the page is not enough for either.
 */
const PASSWORD_TABS: TabKey[] = ['import', 'zugang']

/**
 * `password` is the one the gate in front of this tab has just confirmed, so
 * neither form asks for it again — the server still requires it in the body.
 */
function CredentialsSection({ password }: { password: string }) {
  const [modal, setModal] = useState<'password' | 'pin' | null>(null)
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const close = () => {
    setModal(null)
    setNext('')
    setRepeat('')
    setPin('')
    setError(null)
  }

  const submitPassword = async () => {
    if (next.length < 10) return setError('Neues Passwort braucht mindestens 10 Zeichen.')
    if (next !== repeat) return setError('Die Wiederholung stimmt nicht überein.')
    const result = await changePassword(password, next)
    if (!result.ok) return setError(result.reason)
    close()
    setNotice('Passwort geändert.')
  }

  const submitPin = async () => {
    if (!/^\d{4,8}$/.test(pin.trim())) return setError('Die PIN muss aus 4–8 Ziffern bestehen.')
    const result = await changePin(password, pin.trim())
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

      {/* the one way to revoke this device: the signed board cookie cannot be
          invalidated from elsewhere, so it has to be dropped here */}
      <hr className="section-rule" />
      <button
        onClick={() => {
          if (!confirm('Dieses Gerät sperren? Danach wird hier wieder die Lehrkraft-PIN gebraucht.')) return
          void lockDevice()
          window.location.hash = '#/'
        }}
      >
        <Lock /> Dieses Gerät sperren
      </button>

      {modal === 'password' && (
        <Modal title="Passwort ändern" onClose={close}>
          <div className="field">
            <label htmlFor="cred-next">Neues Passwort</label>
            <input
              id="cred-next" type="password" autoFocus autoComplete="new-password"
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
          <button disabled={!next || !repeat} onClick={() => void submitPassword()}>
            speichern
          </button>
        </Modal>
      )}

      {modal === 'pin' && (
        <Modal title="Lehrkraft-PIN ändern" onClose={close}>
          <div className="field">
            <label htmlFor="cred-pin">Neue PIN</label>
            <input
              id="cred-pin" inputMode="numeric" pattern="[0-9]*" placeholder="4–8 Ziffern" autoFocus
              value={pin} onChange={(e) => setPin(e.target.value)}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button disabled={!pin} onClick={() => void submitPin()}>
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
  const [unlocked, setUnlocked] = useState(false)
  // the school's password once the gate confirmed it, so the credential forms
  // can send it without asking a second time; null means not confirmed yet
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const [pending, setPending] = useState<TabKey | null>(null)
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

  // The teacher PIN is the key to the whole Verwaltung, and it is asked on
  // *every* entry: the device unlock lasts months, a class does not. Component
  // state, not a cookie — leaving the page locks it again. The two tabs in
  // PASSWORD_TABS ask for the school's password on top of it, the same way.
  if (meta.mode === 'api' && !unlocked)
    return (
      <main className="admin">
        <TopBar title="Verwaltung" />
        <PinGate
          intro="Die Verwaltung ist nur für Lehrkräfte. Bitte die PIN eingeben."
          demoPin="hint"
          onSuccess={() => setUnlocked(true)}
          onClose={() => {
            window.location.hash = '#/'
          }}
        />
      </main>
    )

  // the password is asked once per visit to the page, for both protected tabs
  const locked = (key: TabKey) =>
    meta.mode === 'api' && PASSWORD_TABS.includes(key) && confirmed === null

  return (
    <main className="admin">
      <div className="topbar">
        <a href="#/">
          <School className="icon-accent" /> Start
        </a>
        <h1>
          <Settings className="icon-h1" /> Verwaltung
        </h1>
      </div>

      <nav className="tabbar">
        {TABS.filter((t) => t.key !== 'zugang' || meta.mode === 'api').map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : undefined}
            onClick={() => (locked(t.key) ? setPending(t.key) : setTab(t.key))}
          >
            {t.icon} {t.label}
            {/* the lock disappears for both tabs once the password is confirmed */}
            {locked(t.key) && <Lock className="icon-soft" />}
          </button>
        ))}
      </nav>

      {pending && (
        <PasswordGate
          onSuccess={(password) => {
            setConfirmed(password)
            setTab(pending)
            setPending(null)
          }}
          onClose={() => setPending(null)}
        />
      )}

      {tab === 'import' && (
      <section>
        <button onClick={() => setImportOpen(true)}>
          <FileUp /> Kinder aus Excel/CSV importieren
        </button>
        {/* the Feierabend-Reset used to sit here, but it changes today's
            occupancy, not the data this tab administers — it lives on the start
            page now, where the teaching staff needs it daily. */}
        {(meta.mode === 'demo' || meta.dev) && <hr className="section-rule" />}
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

      {tab === 'zugang' && meta.mode === 'api' && <CredentialsSection password={confirmed ?? ''} />}

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
            {state.klasses.map((c) => {
              const kidCount = state.kids.filter((k) => k.klassId === c.id).length
              return (
              <tr key={c.id}>
                <td>
                  <EmojiButton
                    value={c.emoji ?? ''}
                    label={`Emoji für Klasse ${c.name}`}
                    onChange={(emoji) => updateKlass(c.id, { emoji })}
                  />{' '}
                  Klasse {c.name}
                </td>
                <td>{kidCount}</td>
                <td className="td-right">
                  <button
                    className="add danger"
                    aria-label={`Klasse ${c.name} löschen`}
                    onClick={() => {
                      // the number is in the question because this is the one
                      // deletion on the PIN level that takes children with it
                      if (
                        confirm(
                          `Klasse ${c.name} samt ${kidCount} ${kidCount === 1 ? 'Kind' : 'Kindern'} und klassengebundenen Räumen löschen?`,
                        )
                      )
                        removeKlass(c.id)
                    }}
                  >
                    <Trash2 />
                  </button>
                </td>
              </tr>
              )
            })}
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
