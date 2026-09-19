import { Ban, CircleCheck, Hash, KeyRound, Lock, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Account, Role } from '../../types'
import type { AuthResult } from '../../store'
import { changePassword, changePin, createAccount, listAccounts, lockDevice, resetAccountPassword, updateAccount } from '../../store'
import { Modal } from '../../components'
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
    setNotice('Lehrkraft-PIN geändert. Alle Geräte wurden gesperrt.')
  }

  return (
    <section>
      <h3>Zugangsdaten</h3>
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
        <h3>Konten</h3>
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
      <h3>Konten</h3>
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
