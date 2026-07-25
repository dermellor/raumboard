import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Modal } from './components'
import { enterPin } from './store'

/**
 * Teacher PIN prompt — shown when a board interaction needs an unlocked
 * device (api mode without board cookie).
 */
export function PinGate({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const result = await enterPin(pin.trim())
    setBusy(false)
    if (result.ok) onClose()
    else setError(result.reason)
  }

  return (
    <Modal title="Lehrkraft-PIN" onClose={onClose}>
      <p>
        Dieses Gerät ist noch gesperrt. Eine Lehrkraft gibt einmalig die PIN ein, danach kann hier
        gebucht werden.
      </p>
      <div className="field">
        <label htmlFor="pin-input">PIN</label>
        <input
          id="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          autoFocus
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pin.trim()) void submit()
          }}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button disabled={!pin.trim() || busy} onClick={() => void submit()}>
        <KeyRound /> Entsperren
      </button>
    </Modal>
  )
}
