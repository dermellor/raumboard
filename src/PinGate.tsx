import { KeyRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { Modal } from './components'
import { enterPin } from './store'
import { useMeta } from './useBoard'

/**
 * Teacher PIN prompt — shown when a board interaction needs an unlocked
 * device (api mode without board cookie). Renders one slot per PIN digit
 * (length from the server) so it's clear how many digits are expected;
 * digits stay masked so the PIN isn't readable on a classroom whiteboard.
 */
export function PinGate({ onClose }: { onClose: () => void }) {
  const meta = useMeta()
  const length = meta.pinLength ?? null
  const inputRef = useRef<HTMLInputElement>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (value: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await enterPin(value.trim())
    setBusy(false)
    if (result.ok) onClose()
    else {
      setError(result.reason)
      setPin('')
      inputRef.current?.focus()
    }
  }

  const onChange = (raw: string) => {
    const digits = length ? raw.replace(/\D/g, '').slice(0, length) : raw.replace(/\D/g, '')
    setPin(digits)
    setError(null)
    if (length && digits.length === length) void submit(digits)
  }

  const slots = length ? Array.from({ length }, (_, i) => i) : null

  return (
    <Modal title="Lehrkraft-PIN" onClose={onClose}>
      <p>
        Dieses Gerät ist noch gesperrt. Eine Lehrkraft gibt einmalig die PIN ein, danach kann hier
        gebucht werden.
      </p>

      {slots ? (
        <div className="pin-slots" onClick={() => inputRef.current?.focus()}>
          {slots.map((i) => (
            <div
              key={i}
              className={`pin-slot${i < pin.length ? ' filled' : ''}${i === pin.length ? ' active' : ''}`}
            >
              {i < pin.length ? <span className="pin-dot" /> : null}
            </div>
          ))}
          <input
            ref={inputRef}
            className="pin-hidden"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            maxLength={length ?? 8}
            aria-label="PIN"
            value={pin}
            autoFocus
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      ) : (
        <input
          ref={inputRef}
          className="pin-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          maxLength={8}
          aria-label="PIN"
          value={pin}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pin.trim()) void submit(pin)
          }}
        />
      )}

      {error && <p className="form-error pin-error">{error}</p>}
      <button className="pin-submit" disabled={!pin.trim() || busy} onClick={() => void submit(pin)}>
        <KeyRound /> Entsperren
      </button>
    </Modal>
  )
}
