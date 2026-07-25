import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { TopBar } from '../components'
import { login } from '../store'

/** Admin login for the Verwaltung (api mode). */
export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const result = await login(email.trim(), password)
    setBusy(false)
    if (!result.ok) setError(result.reason)
    // success: meta.isAdmin flips via store → Admin renders
  }

  return (
    <main className="admin">
      <TopBar title="Anmelden" />
      <section>
        <p>Die Verwaltung ist geschützt. Bitte mit den Zugangsdaten der Schule anmelden.</p>
        <div className="field">
          <label htmlFor="login-email">E-Mail</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            autoFocus
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Passwort</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email.trim() && password) void submit()
            }}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button disabled={!email.trim() || !password || busy} onClick={() => void submit()}>
          <LogIn /> Anmelden
        </button>
      </section>
    </main>
  )
}
