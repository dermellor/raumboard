import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { PinGate } from './PinGate'
import { reset, resetWithPin } from './store'
import { useMeta } from './useBoard'

/**
 * Feierabend-Reset: books every kid back into their classroom.
 *
 * The PIN is asked for it every time, even on a board whose device unlock is
 * long since done: `rb_board` lasts months and the children operate the
 * whiteboard themselves, so the unlock alone would leave the whole school's
 * bookings one tap and one „OK" away for a class. Same reasoning as the
 * Verwaltung gate — a confirm dialog guards against the slip, not the intent.
 */
export function DayEndReset() {
  const meta = useMeta()
  const [gate, setGate] = useState(false)

  // localStorage mode has no PIN at all, so the
  // gate would unlock on any input — ask the plain question instead.
  const start = () => {
    if (meta.mode === 'api') return setGate(true)
    if (confirm('Alle Kinder zurück in ihre Klassenzimmer buchen?')) reset()
  }

  return (
    <>
      <button onClick={start}>
        <RotateCcw /> Alle zurück in die Klasse
      </button>
      {gate && (
        <PinGate
          title="Alle zurück in die Klasse"
          intro="Alle Kinder werden in ihre Klassenzimmer zurückgebucht. Bitte die Lehrkraft-PIN eingeben."
          authenticate={resetWithPin}
          submitLabel="Alle zurückbuchen"
          onSuccess={() => {
            setGate(false)
          }}
          onClose={() => setGate(false)}
        />
      )}
    </>
  )
}
