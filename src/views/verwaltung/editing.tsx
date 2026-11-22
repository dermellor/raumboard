import { useEffect, useState } from 'react'
import type { Klass, Room } from '../../types'

/**
 * The scope editor inside the drawers' forms: "Alle" on top, a rule, then
 * one row per class, no emojis. While "Alle" is on, the class rows show
 * checked but grayed out — the selection is complete by definition. The
 * empty selection can exist between clicks (it is not a valid scope), so
 * the room keeps its old scope until the drawer's save commits.
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

/* --- end of scope rows ---------------------------------------------------- */
/**
 * A name inside a drawer (kids' names, rooms' names, classes' names).
 * Local state so typing does not fire a request per keystroke; it commits on
 * blur and on Enter, and an emptied field reverts rather than clearing the
 * name.
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
