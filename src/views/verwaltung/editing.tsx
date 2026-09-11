import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Klass, Room } from '../../types'

/**
 * The scope rows shared by the room table's dropdown and the add-room form:
 * "Alle" on top, a rule, then one row per class, no emojis. While "Alle" is
 * on, the class rows show checked but grayed out — the selection is complete
 * by definition. The empty selection can exist between clicks (it is not a
 * valid scope), so the dropdown commits on close and the form's „anlegen"
 * stays disabled meanwhile.
 */
export function ScopeRows({
  klasses,
  value,
  onChange,
}: {
  klasses: Klass[]
  value: Room['scope']
  onChange: (scope: Room['scope']) => void
}) {
  const all = value === 'all'
  const ids = all ? [] : value
  const toggle = (id: string) =>
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  return (
    <div className="scope-rows" role="group" aria-label="Für welche Klassen?">
      <label className="scope-row">
        <input
          type="checkbox"
          checked={all}
          onChange={() => onChange(all ? [] : 'all')}
        />
        Alle
      </label>
      <hr className="scope-rule" />
      {klasses.map((c) => (
        <label key={c.id} className={all ? 'scope-row dim' : 'scope-row'}>
          <input
            type="checkbox"
            checked={all || ids.includes(c.id)}
            disabled={all}
            onChange={() => toggle(c.id)}
          />
          {c.name}
        </label>
      ))}
    </div>
  )
}

/**
 * The scope editor of the room table: a dropdown-style panel anchored under
 * the "Für" cell. Clicks edit a draft; closing commits it (an empty draft
 * keeps the room as it was, since "keine Klasse" is not a valid scope).
 */
export function ScopeDropdown({
  anchor,
  klasses,
  value,
  onChange,
  onClose,
}: {
  anchor: HTMLElement
  klasses: Klass[]
  value: Room['scope']
  onChange: (scope: Room['scope']) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // measured after render and re-measured on every scroll, so the menu opens
  // below the cell when it fits, flips above it when the viewport ends first,
  // clamps as a last resort, and moves with the cell while the page scrolls,
  // like a native dropdown
  const position = useCallback(() => {
    const menu = ref.current
    if (!menu) return
    const rect = anchor.getBoundingClientRect()
    const h = menu.offsetHeight
    const w = menu.offsetWidth
    let top: number
    if (rect.bottom + 4 + h <= window.innerHeight) top = rect.bottom + 4
    else if (rect.top - 4 - h >= 8) top = rect.top - h - 4
    else top = Math.max(8, window.innerHeight - h - 8)
    menu.style.top = `${top}px`
    menu.style.left = `${Math.min(rect.left, Math.max(8, window.innerWidth - w - 8))}px`
    menu.style.visibility = ''
  }, [anchor])
  useLayoutEffect(position)
  useEffect(() => {
    const onMove = () => position()
    // capture: the page can scroll in any ancestor, not just the window
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [position])
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // a pointerdown on the anchor itself is left to the button's click, so
      // the cell toggles the menu instead of closing and reopening it
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !anchor.contains(e.target as Node)
      )
        onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchor])
  // off-screen until the effect positions it; `visibility` instead of `display`
  // so the measurement has a size to work with
  return (
    <div className="scope-menu" ref={ref} style={{ visibility: 'hidden' }}>
      <ScopeRows klasses={klasses} value={value} onChange={onChange} />
    </div>
  )
}

/**
 * A name in a table cell, editable inline like the symbol and neighbours next
 * to it (kids' names, rooms' names). Local state so typing does not fire a request
 * per keystroke; it commits on blur and on Enter, and an emptied field reverts
 * rather than clearing the name.
 */
export function NameField({
  value,
  label,
  onCommit,
}: {
  value: string
  label: string
  onCommit: (name: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const name = draft.trim()
    if (!name) return setDraft(value)
    if (name !== value) onCommit(name)
  }
  return (
    <input
      className="inline-name"
      value={draft}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}
