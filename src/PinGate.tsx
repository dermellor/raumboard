import { KeyRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { Modal } from './components'
import type { AuthResult } from './storeTypes'
import { useMeta } from './useBoard'

/**
 * Teacher PIN prompt — shown when a board interaction needs an unlocked
 * device (api mode without board cookie), and every time the Verwaltung is
 * entered. Renders one slot per PIN digit (length from the server) so it's
 * clear how many digits are expected; digits stay masked so the PIN isn't
 * readable on a classroom whiteboard.
 *
 * `onSuccess` and `onClose` differ where dismissing the gate has to do more
 * than close a modal (the Verwaltung leaves the page).
 */
export function PinGate({
  onClose,
  onSuccess = onClose,
  title = 'Lehrkraft-PIN',
  intro = 'Dieses Gerät ist noch gesperrt. Eine Lehrkraft gibt einmalig die PIN ein, danach kann hier gebucht werden.',
  demoPin = 'prefill',
  authenticate,
  closable = true,
  submitLabel = 'Bestätigen',
}: {
  onClose: () => void
  onSuccess?: () => void
  title?: string
  intro?: string
  /**
   * What a demo board does with its published PIN. Boards prefill it, so a
   * visitor reaches the product without copying credentials off a website.
   * The Verwaltung shows it instead: there the gate is the thing being
   * demonstrated, and a filled field would hide it behind one click.
   */
  demoPin?: 'prefill' | 'hint'
  authenticate: (pin: string) => Promise<AuthResult>
  closable?: boolean
  submitLabel?: string
}) {
  const meta = useMeta()
  const length = meta.pinLength ?? null
  const inputRef = useRef<HTMLInputElement>(null)
  const demoValue = meta.demoCredentials?.pin ?? null
  // filling the slots does not submit, so the gate still has to be confirmed
  // and stays part of what a visitor sees
  const [pin, setPin] = useState(demoPin === 'prefill' ? (demoValue ?? '') : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (value: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await authenticate(value.trim())
    setBusy(false)
    if (result.ok) onSuccess()
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
    <Modal title={title} onClose={onClose} closable={closable}>
      <p>{intro}</p>
      {demoPin === 'hint' && demoValue && <p className="pin-hint">PIN dieser Demo: {demoValue}</p>}

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
        <KeyRound /> {submitLabel}
      </button>
    </Modal>
  )
}
