import { useState } from 'react'
import { Symbol } from '../../Symbol'
import { useMeta } from '../../useBoard'
import { setSymbols, setRoomsHeading } from '../../store'

/**
 * How the boards draw symbols, school-wide and at once. Every write on this
 * page needs a signed-in account: it changes the boards for everyone, while a
 * teacher with the PIN only reads the current setting.
 */
export function TafelnPage() {
  const meta = useMeta()
  const current = meta.symbols ?? 'openmoji'
  // the draft starts null so a meta that arrives late (first fetch still on
  // its way) fills the field instead of freezing an early empty string
  const [headingDraft, setHeadingDraft] = useState<string | null>(null)
  const headingValue = headingDraft ?? meta.roomsHeading ?? ''

  return (
    <>
      <section>
        <h3>Symbole auf den Tafeln</h3>
        <div className="settings-options">
          <label className="settings-option">
            <input
              type="radio"
              name="symbols"
              checked={current === 'openmoji'}
              disabled={!meta.isAdmin}
              onChange={() => void setSymbols('openmoji')}
            />
            <Symbol className="settings-preview" value="🐱" force="openmoji" />
            <span className="settings-option-text">
              <strong>Raumboard-Symbole</strong>
              <span className="subline">
                Gezeichnete Icons, auf jedem Gerät gleich. Von{' '}
                <a href="https://openmoji.org" target="_blank" rel="noreferrer">
                  OpenMoji
                </a>{' '}
                (CC BY-SA 4.0).
              </span>
            </span>
          </label>
          <label className="settings-option">
            <input
              type="radio"
              name="symbols"
              checked={current === 'native'}
              disabled={!meta.isAdmin}
              onChange={() => void setSymbols('native')}
            />
            <Symbol className="settings-preview" value="🐱" force="native" />
            <span className="settings-option-text">
              <strong>Browser-Symbole</strong>
              <span className="subline">
                Native Emojis, je nach System und Browser unterschiedlich.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section>
        <h3>Überschrift auf der Startseite</h3>
        <p className="hint">
          Steht über den Raum-Kacheln der Startseite. Leer lässt den Standard
          „Lernorte“ stehen.
        </p>
        <div className="field">
          <label htmlFor="rooms-heading">Überschrift</label>
          <input
            id="rooms-heading"
            value={headingValue}
            placeholder="Lernorte"
            maxLength={60}
            disabled={!meta.isAdmin}
            onChange={(e) => setHeadingDraft(e.target.value)}
          />
          {meta.isAdmin && (
            <button
              disabled={headingValue.trim() === (meta.roomsHeading ?? '')}
              onClick={() => {
                void setRoomsHeading(headingValue)
                setHeadingDraft(null)
              }}
            >
              speichern
            </button>
          )}
        </div>
      </section>
    </>
  )
}
