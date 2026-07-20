import { useState } from 'react'
import { EMOJI_CATEGORIES, searchEmojis } from './emojis'

/**
 * Emoji field with a built-in touch picker: tap the emoji, tap a new one.
 * Whiteboards and school PCs have no emoji keyboard, so the picker offers
 * browsing by category plus a German keyword search.
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
  const [query, setQuery] = useState('')

  const pick = (emoji: string) => {
    onChange(emoji)
    setOpen(false)
    setQuery('')
  }

  const results = searchEmojis(query)

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
            <input
              className="emoji-search"
              type="search"
              placeholder="🔍 Suchen (z.B. Eule, Fußball, blau)"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
            {query.trim() ? (
              <section>
                {results.length === 0 ? (
                  <p className="count">Nichts gefunden. Anders schreiben oder unten stöbern:</p>
                ) : (
                  <div className="emoji-grid">
                    {results.map((e) => (
                      <button key={e} aria-pressed={e === value} onClick={() => pick(e)}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
            {(!query.trim() || results.length === 0) &&
              EMOJI_CATEGORIES.map((cat) => (
                <section key={cat.name}>
                  <h3>{cat.name}</h3>
                  <div className="emoji-grid">
                    {cat.emojis.map((e) => (
                      <button key={e} aria-pressed={e === value} onClick={() => pick(e)}>
                        {e}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </div>
      )}
    </>
  )
}
