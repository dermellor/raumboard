import { useState } from 'react'
import { EMOJI_CATEGORIES } from './emojis'

/**
 * Emoji field with a built-in touch picker: tap the emoji, tap a new one.
 * Whiteboards and school PCs have no emoji keyboard, so free-text is only
 * offered as a fallback inside the picker.
 */
export function EmojiButton({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (emoji: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')

  const pick = (emoji: string) => {
    onChange(emoji)
    setOpen(false)
    setCustom('')
  }

  return (
    <>
      <button className="emoji-btn" aria-label={label} title={label} onClick={() => setOpen(true)}>
        {value || '➕'}
      </button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="picker" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setOpen(false)} aria-label="Schließen">
              ✕
            </button>
            <h2>Symbol aussuchen</h2>
            {EMOJI_CATEGORIES.map((cat) => (
              <section key={cat.name}>
                <h3>{cat.name}</h3>
                <div className="emoji-grid">
                  {cat.emojis.map((e) => (
                    <button
                      key={e}
                      aria-pressed={e === value}
                      onClick={() => pick(e)}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </section>
            ))}
            <section>
              <h3>Eigenes Zeichen</h3>
              <input
                value={custom}
                placeholder="hier eintippen"
                onChange={(e) => setCustom(e.target.value)}
              />{' '}
              <button disabled={!custom.trim()} onClick={() => pick(custom.trim())}>
                übernehmen
              </button>
            </section>
          </div>
        </div>
      )}
    </>
  )
}
