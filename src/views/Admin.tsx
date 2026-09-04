import {
  Ban, Baby, ChevronDown, CircleCheck, FileUp, Hash, KeyRound, LayoutGrid, Lock, Plus,
  School, Settings, Sprout, Trash2, Upload, UserCog, Users,
} from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  addKid, addKlass, addRoom, changePassword, changePin, createAccount, listAccounts,
  lockDevice, occupancy, removeKid, removeKlass, removeRoom, reseed, resetAccountPassword,
  updateAccount, updateKid, updateKlass, updateRoom,
} from '../store'
import type { AuthResult } from '../store'
import type { Account, Klass, Role, Room } from '../types'
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

/** Which classes may book a room, as one label: "alle" or the class names. */
function scopeLabel(scope: Room['scope'], klasses: Klass[]): string {
  if (scope === 'all') return 'alle'
  return scope.map((id) => klasses.find((c) => c.id === id)?.name ?? id).join(', ')
}

/**
 * The scope rows shared by the room table's dropdown and the add-room form:
 * "Alle" on top, a rule, then one row per class, no emojis. While "Alle" is
 * on, the class rows show checked but grayed out — the selection is complete
 * by definition. The empty selection can exist between clicks (it is not a
 * valid scope), so the dropdown commits on close and the form's „anlegen"
 * stays disabled meanwhile.
 */
function ScopeRows({
  klasses,
  value,
  onChange,
}: {
  klasses: Klass[]
  value: Room['scope']
  onChange: (scope: Room['scope']) => void
}) {
  const all = value === 'all'
  const ids = all ? [] : value
  const toggle = (id: string) =>
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  return (
    <div className="scope-rows" role="group" aria-label="Für welche Klassen?">
      <label className="scope-row">
        <input
          type="checkbox"
          checked={all}
          onChange={() => onChange(all ? [] : 'all')}
        />
        Alle
      </label>
      <hr className="scope-rule" />
      {klasses.map((c) => (
        <label key={c.id} className={all ? 'scope-row dim' : 'scope-row'}>
          <input
            type="checkbox"
            checked={all || ids.includes(c.id)}
            disabled={all}
            onChange={() => toggle(c.id)}
          />
          {c.name}
        </label>
      ))}
    </div>
  )
}

/**
 * The scope editor of the room table: a dropdown-style panel anchored under
 * the "Für" cell. Clicks edit a draft; closing commits it (an empty draft
 * keeps the room as it was, since "keine Klasse" is not a valid scope).
 */
function ScopeDropdown({
  anchor,
  klasses,
  value,
  onChange,
  onClose,
}: {
  anchor: HTMLElement
  klasses: Klass[]
  value: Room['scope']
  onChange: (scope: Room['scope']) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // measured after render and re-measured on every scroll, so the menu opens
  // below the cell when it fits, flips above it when the viewport ends first,
  // clamps as a last resort, and moves with the cell while the page scrolls,
  // like a native dropdown
  const position = useCallback(() => {
    const menu = ref.current
    if (!menu) return
    const rect = anchor.getBoundingClientRect()
    const h = menu.offsetHeight
    const w = menu.offsetWidth
    let top: number
    if (rect.bottom + 4 + h <= window.innerHeight) top = rect.bottom + 4
    else if (rect.top - 4 - h >= 8) top = rect.top - h - 4
    else top = Math.max(8, window.innerHeight - h - 8)
    menu.style.top = `${top}px`
    menu.style.left = `${Math.min(rect.left, Math.max(8, window.innerWidth - w - 8))}px`
    menu.style.visibility = ''
  }, [anchor])
  useLayoutEffect(position)
  useEffect(() => {
    const onMove = () => position()
    // capture: the page can scroll in any ancestor, not just the window
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [position])
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // a pointerdown on the anchor itself is left to the button's click, so
      // the cell toggles the menu instead of closing and reopening it
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !anchor.contains(e.target as Node)
      )
        onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchor])
  // off-screen until the effect positions it; `visibility` instead of `display`
  // so the measurement has a size to work with
  return (
    <div className="scope-menu" ref={ref} style={{ visibility: 'hidden' }}>
      <ScopeRows klasses={klasses} value={value} onChange={onChange} />
    </div>
  )
}

/**
 * A name in a table cell, editable inline like the symbol and neighbours next
 * to it (kids' names, rooms' names). Local state so typing does not fire a request
 * per keystroke; it commits on blur and on Enter, and an emptied field reverts
 * rather than clearing the name.
 */
function NameField({
  value,
  label,
  onCommit,
}: {
  value: string
  label: string
  onCommit: (name: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const name = draft.trim()
    if (!name) return setDraft(value)
    if (name !== value) onCommit(name)
  }
  return (
    <input
      className="inline-name"
      value={draft}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}

const TABS = [
  { key: 'raeume', label: 'Räume', icon: <LayoutGrid /> },
  { key: 'klassen', label: 'Klassen', icon: <Users /> },
  { key: 'kinder', label: 'Kinder', icon: <Baby /> },
  { key: 'import', label: 'Kinder importieren', icon: <Upload /> },
  { key: 'zugang', label: 'Zugangsdaten', icon: <KeyRound /> },
  { key: 'konten', label: 'Konten', icon: <UserCog /> },
] as const
type TabKey = (typeof TABS)[number]['key']

/** Tabs that only make sense against the server (api mode), never in the demo. */
const API_ONLY_TABS: TabKey[] = ['zugang', 'konten']

/**
 * The tabs that ask for the school's password before they open: the import
 * brings personal data in from outside, „Zugangsdaten" holds the keys to the
 * school, and „Konten" is the account roster. The teacher PIN in front of the
 * page is not enough for any of them.
 */
const PASSWORD_TABS: TabKey[] = ['import', 'zugang', 'konten']

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

/**
 * The account roster, owner only. The two server invariants are mirrored here as
 * disabled controls (the server still enforces them): the school keeps at least
 * one active owner, and an owner does not demote or deactivate their own account.
 * New and reset passwords are shown once, since none is stored in the clear.
 */
function AccountsSection() {
  const meta = useMeta()
  const isOwner = meta.account?.role === 'owner'
  const me = meta.account?.email
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('admin')
  // a generated password to show exactly once, for a new or reset account
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null)

  const load = () => void listAccounts().then(setAccounts)
  useEffect(() => {
    if (isOwner) load()
  }, [isOwner])

  if (!isOwner)
    return (
      <section>
        <p className="count">Die Kontenverwaltung ist nur für Inhaber-Konten.</p>
      </section>
    )

  const activeOwners = (accounts ?? []).filter((a) => a.role === 'owner' && a.active).length

  const run = (p: Promise<AuthResult>) => {
    setError(null)
    void p.then((r) => {
      if (!r.ok) setError(r.reason)
      load()
    })
  }

  const submitAdd = async () => {
    setError(null)
    const r = await createAccount(newEmail.trim(), newRole)
    if (!r.ok) return setError(r.reason)
    setAddOpen(false)
    setNewEmail('')
    setNewRole('admin')
    setShown({ email: r.account.email, password: r.password })
    load()
  }

  const resetPw = async (a: Account) => {
    setError(null)
    const r = await resetAccountPassword(a.id)
    if (!r.ok) return setError(r.reason)
    setShown({ email: a.email, password: r.password })
  }

  return (
    <section>
      <table>
        <thead>
          <tr>
            <th>E-Mail</th><th>Rolle</th><th>Status</th><th>Anmeldung</th>
            <th className="th-add">
              <button
                className="add"
                aria-label="Konto hinzufügen"
                onClick={() => {
                  setError(null)
                  setAddOpen(true)
                }}
              >
                <Plus />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {(accounts ?? []).map((a) => {
            const self = a.email === me
            // the two cases the server refuses, disabled here too
            const protectedOwner = a.role === 'owner' && (self || activeOwners <= 1)
            return (
              <tr key={a.id} className={a.active ? undefined : 'closed'}>
                <td>{a.email}{self && ' (Sie)'}</td>
                <td>
                  <select
                    value={a.role}
                    disabled={protectedOwner}
                    onChange={(e) => run(updateAccount(a.id, { role: e.target.value as Role }))}
                  >
                    <option value="owner">Inhaber</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{a.active ? 'aktiv' : 'deaktiviert'}</td>
                <td>
                  <button
                    className="toggle"
                    disabled={a.active && protectedOwner}
                    onClick={() => run(updateAccount(a.id, { active: !a.active }))}
                  >
                    {a.active ? (
                      <><Ban className="icon-amber" /> Deaktivieren</>
                    ) : (
                      <><CircleCheck className="icon-green" /> Aktivieren</>
                    )}
                  </button>
                </td>
                <td className="td-right">
                  <button onClick={() => void resetPw(a)}>
                    <KeyRound /> Passwort zurücksetzen
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {error && <p className="form-error">{error}</p>}

      {addOpen && (
        <Modal title="Konto hinzufügen" onClose={() => setAddOpen(false)}>
          <div className="field">
            <label htmlFor="acc-email">E-Mail</label>
            <input
              id="acc-email"
              type="email"
              autoFocus
              autoComplete="off"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="acc-role">Rolle</label>
            <select id="acc-role" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
              <option value="admin">Admin</option>
              <option value="owner">Inhaber</option>
            </select>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button disabled={!newEmail.trim()} onClick={() => void submitAdd()}>
            anlegen
          </button>
        </Modal>
      )}

      {shown && (
        <Modal title="Passwort" onClose={() => setShown(null)}>
          <p>
            Passwort für <strong>{shown.email}</strong>. Es wird nur jetzt angezeigt, bitte
            notieren und persönlich weitergeben.
          </p>
          <p className="field">
            <code>{shown.password}</code>
          </p>
          <button onClick={() => setShown(null)}>fertig</button>
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
  const [roomScope, setRoomScope] = useState<Room['scope']>('all')
  const [kidName, setKidName] = useState('')
  const [kidSymbol, setKidSymbol] = useState('⭐')
  const [kidKlass, setKidKlass] = useState('')
  const [klassName, setKlassName] = useState('')
  const [klassEmoji, setKlassEmoji] = useState('🚪')
  // the room whose scope is being edited from the "Für" cell of the table:
  // the cell's element (the dropdown anchors under it) and the draft
  const [scopeEdit, setScopeEdit] = useState<{ id: string; anchor: HTMLElement } | null>(null)
  const [scopeDraft, setScopeDraft] = useState<Room['scope']>('all')
  // the one way the dropdown leaves the stage: an empty draft keeps the room as
  // it was, everything else applies when it differs, and every closing path
  // (outside click, Escape, the cell's own toggle) runs through here
  const closeScope = () => {
    const room = scopeEdit ? state.rooms.find((r) => r.id === scopeEdit.id) : undefined
    if (room && (scopeDraft === 'all' || scopeDraft.length > 0) && scopeDraft !== room.scope)
      updateRoom(room.id, { scope: scopeDraft })
    setScopeEdit(null)
  }

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
        {TABS.filter((t) => !API_ONLY_TABS.includes(t.key) || meta.mode === 'api').map((t) => (
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

      {tab === 'konten' && meta.mode === 'api' && <AccountsSection />}

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
                  <NameField
                    value={r.name}
                    label={`Name von ${r.name}`}
                    onCommit={(name) => updateRoom(r.id, { name })}
                  />
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
                <td>
                  <button
                    className="scope-edit"
                    title="Klassen ändern"
                    aria-haspopup="true"
                    aria-expanded={scopeEdit?.id === r.id}
                    onClick={(e) => {
                      // a click on the open cell toggles it shut, through the
                      // same commit path as clicking anywhere else
                      if (scopeEdit?.id === r.id) closeScope()
                      else {
                        setScopeEdit({ id: r.id, anchor: e.currentTarget })
                        setScopeDraft(r.scope)
                      }
                    }}
                  >
                    {scopeLabel(r.scope, state.klasses)} <ChevronDown className="icon-soft" size={16} />
                  </button>
                </td>
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
          <div className="field field-scope">
            <label>Für</label>
            <div className="scope-inline">
              <ScopeRows klasses={state.klasses} value={roomScope} onChange={setRoomScope} />
            </div>
          </div>
          <button
            disabled={!roomName.trim() || (roomScope !== 'all' && roomScope.length === 0)}
            onClick={() => {
              addRoom(roomName.trim(), roomEmoji || '🚪', roomCapacity, roomScope)
              setRoomName('')
              setRoomScope('all')
              setModal(null)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}

      {scopeEdit &&
        (() => {
          // resolved live, so a deleted room simply closes the dropdown
          const room = state.rooms.find((r) => r.id === scopeEdit.id)
          if (!room) return null
          return (
            <ScopeDropdown
              anchor={scopeEdit.anchor}
              klasses={state.klasses}
              value={scopeDraft}
              onChange={setScopeDraft}
              onClose={closeScope}
            />
          )
        })()}

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
