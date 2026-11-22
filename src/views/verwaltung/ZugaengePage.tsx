import { Ban, CircleCheck, Hash, KeyRound, Lock, Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Account, Role } from '../../types'
import type { AuthResult } from '../../store'
import { changePassword, changePin, createAccount, listAccounts, lockDevice, resetAccountPassword, updateAccount } from '../../store'
import { Modal } from '../../components'
import { Drawer } from '../../Drawer'
import { useMeta } from '../../useBoard'

/**
 * This page asks for the school's password before it opens: it holds the keys
 * to the school. `password` is the one the gate in front of the page has just
 * confirmed, so no form here asks for it again — the server still requires it
 * in the body.
 */
export function ZugaengePage({ password }: { password: string }) {
  return (
    <>
      <CredentialsSection password={password} />
      <AccountsSection />
      <GeraetSection />
    </>
  )
}

function CredentialsSection({ password }: { password: string }) {
  const [form, setForm] = useState<'password' | 'pin' | null>(null)
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const close = () => {
    setForm(null)
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
    setNotice('Lehrkraft-PIN geändert. Alle Geräte wurden gesperrt.')
  }

  return (
    <section>
      <h3>Zugangsdaten</h3>
      <button onClick={() => { setNotice(null); setForm('password') }}>
        <KeyRound /> Passwort ändern
      </button>{' '}
      <button onClick={() => { setNotice(null); setForm('pin') }}>
        <Hash /> Lehrkraft-PIN ändern
      </button>
      {notice && <p className="count">{notice}</p>}

      {form === 'password' && (
        <Drawer title="Passwort ändern" onClose={close}>
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
          <div className="field">
            <button className="primary" disabled={!next || !repeat} onClick={() => void submitPassword()}>
              speichern
            </button>
          </div>
        </Drawer>
      )}

      {form === 'pin' && (
        <Drawer title="Lehrkraft-PIN ändern" onClose={close}>
          <div className="field">
            <label htmlFor="cred-pin">Neue PIN</label>
            <input
              id="cred-pin" inputMode="numeric" pattern="[0-9]*" placeholder="4–8 Ziffern" autoFocus
              value={pin} onChange={(e) => setPin(e.target.value)}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="field">
            <button disabled={!pin} onClick={() => void submitPin()}>
              speichern
            </button>
          </div>
        </Drawer>
      )}
    </section>
  )
}

/** The account in the drawer: role and status edit here, not in the table. */
function AccountDrawer({
  account,
  protectedOwner,
  onClose,
  onPassword,
}: {
  account: Account
  protectedOwner: boolean
  onClose: () => void
  onPassword: (email: string, password: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const me = useMeta().account?.email
  const self = account.email === me

  const run = (p: Promise<AuthResult>) => {
    setError(null)
    setBusy(true)
    void p.then((r) => {
      if (!r.ok) setError(r.reason)
      setBusy(false)
    })
  }
  const reset = async () => {
    setError(null)
    setBusy(true)
    const r = await resetAccountPassword(account.id)
    setBusy(false)
    if (!r.ok) return setError(r.reason)
    onPassword(account.email, r.password)
  }

  return (
    <Drawer
      title={account.email}
      onClose={onClose}
      footer={
        <button disabled={busy} onClick={() => void reset()}>
          <KeyRound /> Passwort zurücksetzen
        </button>
      }
    >
      <div className="field">
        <label htmlFor={`acc-role-${account.id}`}>Rolle</label>
        <select
          id={`acc-role-${account.id}`}
          value={account.role}
          disabled={protectedOwner}
          onChange={(e) => run(updateAccount(account.id, { role: e.target.value as Role }))}
        >
          <option value="owner">Inhaber</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="field">
        <label>Status</label>
        <button
          className="toggle"
          disabled={(account.active && protectedOwner) || busy}
          onClick={() => run(updateAccount(account.id, { active: !account.active }))}
        >
          {account.active ? (
            <><Ban className="icon-amber" /> Deaktivieren</>
          ) : (
            <><CircleCheck className="icon-green" /> Aktivieren</>
          )}
        </button>
      </div>
      {self && <p className="hint">Das eigene Konto: Rolle und Status bleiben geschützt.</p>}
      {error && <p className="form-error">{error}</p>}
    </Drawer>
  )
}

/** The same drawer in create mode; the generated password shows once after. */
function NewAccountDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: (email: string, password: string) => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('admin')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    const r = await createAccount(email.trim(), role)
    if (!r.ok) return setError(r.reason)
    setEmail('')
    setRole('admin')
    onClose()
    onCreated(r.account.email, r.password)
  }

  return (
    <Drawer title="Konto hinzufügen" onClose={onClose}>
      <div className="field">
        <label htmlFor="acc-email">E-Mail</label>
        <input
          id="acc-email"
          type="email"
          autoFocus
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="acc-role">Rolle</label>
        <select id="acc-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="admin">Admin</option>
          <option value="owner">Inhaber</option>
        </select>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="field">
        <button className="primary" disabled={!email.trim()} onClick={() => void submit()}>
          anlegen
        </button>
      </div>
    </Drawer>
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
  const [editOpen, setEditOpen] = useState<string | null>(null)
  // a generated password to show exactly once, for a new or reset account
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null)

  const load = () => void listAccounts().then(setAccounts)
  useEffect(() => {
    if (isOwner) load()
  }, [isOwner])

  if (!isOwner)
    return (
      <section>
        <h3>Konten</h3>
        <p className="count">Die Kontenverwaltung ist nur für Inhaber-Konten.</p>
      </section>
    )

  const activeOwners = (accounts ?? []).filter((a) => a.role === 'owner' && a.active).length

  return (
    <section>
      <h3>Konten</h3>
      <div className="table-wrap">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>E-Mail</th><th>Rolle</th><th>Status</th>
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
            {(accounts ?? []).map((a) => (
              <tr key={a.id} className={a.active ? undefined : 'closed'}>
                <td className="cell-name">
                  <div className="cell-name-inner">
                    <span className="kid-name">{a.email}{a.email === me && ' (Sie)'}</span>
                  </div>
                </td>
                <td>{a.role === 'owner' ? 'Inhaber' : 'Admin'}</td>
                <td>{a.active ? 'aktiv' : 'deaktiviert'}</td>
                <td className="td-edit">
                  <button
                    className="row-edit"
                    aria-label={`Konto ${a.email} bearbeiten`}
                    onClick={() => setEditOpen(a.id)}
                  >
                    <Pencil />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="form-error">{error}</p>}

      {addOpen && (
        <NewAccountDrawer
          onClose={() => setAddOpen(false)}
          onCreated={(email, password) => setShown({ email, password })}
        />
      )}
      {editOpen && (() => {
        const account = (accounts ?? []).find((a) => a.id === editOpen)
        if (!account) return null
        const protectedOwner =
          account.role === 'owner' && (account.email === me || activeOwners <= 1)
        return (
          <AccountDrawer
            account={account}
            protectedOwner={protectedOwner}
            onClose={() => setEditOpen(null)}
            onPassword={(email, password) => setShown({ email, password })}
          />
        )
      })()}
      {/* the one-time password is a notice, not an edit: it stays a modal */}
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

function GeraetSection() {
  return (
    <section>
      <h3>Dieses Gerät</h3>
      {/* the one way to revoke this device: the signed board cookie cannot be
          invalidated from elsewhere, so it has to be dropped here */}
      <button
        onClick={() => {
          if (!confirm('Dieses Gerät sperren? Danach wird hier wieder die Lehrkraft-PIN gebraucht.')) return
          void lockDevice()
          window.location.hash = '#/'
        }}
      >
        <Lock /> Dieses Gerät sperren
      </button>
    </section>
  )
}
