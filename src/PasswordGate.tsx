import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Modal } from './components'
import { login, verifyPassword } from './store'
import { useMeta } from './useBoard'

/**
 * Proof of the school's account, for the three places that need it: the sign-in
 * on the start page, the confirmation in front of the Zugänge page, and the
 * one in front of the import button.
 *
 * With an admin session it asks for the password alone and only verifies it;
 * without one it asks for the email as well and signs in, because a session
 * that does not exist yet cannot be confirmed. Either way the caller receives
 * the password, so the credential forms behind this gate do not have to ask for
 * the same secret a second time.
 */
export function PasswordGate({
  onSuccess,
  onClose,
}: {
  onSuccess: (password: string) => void
  onClose: () => void
}) {
  const meta = useMeta()
  // the demo hands its own credentials over, so nobody has to copy them in
  const demo = meta.demoCredentials
  const signIn = !meta.isAdmin
  const [email, setEmail] = useState(demo?.email ?? '')
  const [password, setPassword] = useState(demo?.password ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ready = password.length > 0 && (!signIn || email.trim().length > 0)

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    const result = signIn ? await login(email.trim(), password) : await verifyPassword(password)
    setBusy(false)
    if (result.ok) onSuccess(password)
    else setError(result.reason)
  }

  return (
    <Modal title={signIn ? 'Anmelden' : 'Passwort bestätigen'} onClose={onClose}>
      {signIn && (
        <div className="field">
          <label htmlFor="gate-email">E-Mail</label>
          <input
            id="gate-email"
            type="email"
            autoComplete="username"
            value={email}
            autoFocus
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor="gate-password">Passwort</label>
        <input
          id="gate-password"
          type="password"
          autoComplete="current-password"
          value={password}
          autoFocus={!signIn}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button disabled={!ready || busy} onClick={() => void submit()}>
        <LogIn /> {signIn ? 'Anmelden' : 'Bestätigen'}
      </button>
    </Modal>
  )
}
