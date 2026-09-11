import { Ban, ChevronDown, CircleCheck, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Klass, Room } from '../../types'
import { EmojiButton } from '../../EmojiButton'
import { Modal } from '../../components'
import { occupancy } from '../../store'
import { addRoom, removeRoom, updateRoom } from '../../store'
import { useBoard } from '../../useBoard'
import { NameField, ScopeDropdown, ScopeRows } from './editing'

/** Which classes may book a room, as one label: "alle" or the class names. */
function scopeLabel(scope: Room['scope'], klasses: Klass[]): string {
  if (scope === 'all') return 'alle'
  return scope.map((id) => klasses.find((c) => c.id === id)?.name ?? id).join(', ')
}

export function RaeumePage() {
  const state = useBoard()
  const [modal, setModal] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomEmoji, setRoomEmoji] = useState('🚪')
  const [roomCapacity, setRoomCapacity] = useState(4)
  const [roomScope, setRoomScope] = useState<Room['scope']>('all')
  // the room whose scope is being edited from the "Für" cell of the table:
  // the cell's element (the dropdown anchors under it) and the draft
  const [scopeEdit, setScopeEdit] = useState<{ id: string; anchor: HTMLElement } | null>(null)
  const [scopeDraft, setScopeDraft] = useState<Room['scope']>('all')
  // the one way the dropdown leaves the stage: an empty draft keeps the room as
  // it was, everything else applies when it differs, and every closing path
  // (outside click, Escape, the cell's own toggle) runs through here
  const closeScope = () => {
    const room = scopeEdit ? state.rooms.find((r) => r.id === scopeEdit.id) : undefined
    if (room && (scopeDraft === 'all' || scopeDraft.length > 0) && scopeDraft !== room.scope)
      updateRoom(room.id, { scope: scopeDraft })
    setScopeEdit(null)
  }

  return (
    <section>
      <table>
        <thead>
          <tr>
            <th>Raum</th><th>Kapazität</th><th>Belegt</th><th>Für</th><th>Status</th>
            <th className="th-add">
              <button className="add" aria-label="Raum hinzufügen" onClick={() => setModal(true)}>
                <Plus />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {state.rooms.map((r) => (
            <tr key={r.id} className={r.isOpen ? undefined : 'closed'}>
              <td>
                <EmojiButton
                  value={r.emoji}
                  label={`Emoji für ${r.name}`}
                  onChange={(emoji) => updateRoom(r.id, { emoji })}
                />{' '}
                <NameField
                  value={r.name}
                  label={`Name von ${r.name}`}
                  onCommit={(name) => updateRoom(r.id, { name })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={r.capacity}
                  style={{ width: '4em' }}
                  onChange={(e) => updateRoom(r.id, { capacity: Math.max(0, Number(e.target.value)) })}
                />
              </td>
              <td>{occupancy(r.id, state)}</td>
              <td>
                <button
                  className="scope-edit"
                  title="Klassen ändern"
                  aria-haspopup="true"
                  aria-expanded={scopeEdit?.id === r.id}
                  onClick={(e) => {
                    // a click on the open cell toggles it shut, through the
                    // same commit path as clicking anywhere else
                    if (scopeEdit?.id === r.id) closeScope()
                    else {
                      setScopeEdit({ id: r.id, anchor: e.currentTarget })
                      setScopeDraft(r.scope)
                    }
                  }}
                >
                  {scopeLabel(r.scope, state.klasses)} <ChevronDown className="icon-soft" size={16} />
                </button>
              </td>
              <td>
                <button className="toggle" onClick={() => updateRoom(r.id, { isOpen: !r.isOpen })}>
                  {r.isOpen ? (
                    <>
                      <Ban className="icon-amber" /> Schließen
                    </>
                  ) : (
                    <>
                      <CircleCheck className="icon-green" /> Öffnen
                    </>
                  )}
                </button>
              </td>
              <td className="td-right">
                <button
                  className="add danger"
                  aria-label={`Raum ${r.name} löschen`}
                  onClick={() => {
                    if (confirm(`Raum „${r.name}" löschen? Eingebuchte Kinder gehen zurück in die Klasse.`))
                      removeRoom(r.id)
                  }}
                >
                  <Trash2 />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title="Raum hinzufügen" onClose={() => setModal(false)}>
          <div className="field">
            <label>Symbol</label>
            <EmojiButton value={roomEmoji} label="Emoji für neuen Raum" onChange={setRoomEmoji} />
          </div>
          <div className="field">
            <label htmlFor="room-name">Name</label>
            <input
              id="room-name"
              placeholder="z.B. Leseecke"
              value={roomName}
              autoFocus
              onChange={(e) => setRoomName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="room-capacity">Kapazität</label>
            <input
              id="room-capacity"
              type="number"
              min={0}
              value={roomCapacity}
              style={{ width: '5em' }}
              onChange={(e) => setRoomCapacity(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="field field-scope">
            <label>Für</label>
            <div className="scope-inline">
              <ScopeRows klasses={state.klasses} value={roomScope} onChange={setRoomScope} />
            </div>
          </div>
          <button
            disabled={!roomName.trim() || (roomScope !== 'all' && roomScope.length === 0)}
            onClick={() => {
              addRoom(roomName.trim(), roomEmoji || '🚪', roomCapacity, roomScope)
              setRoomName('')
              setRoomScope('all')
              setModal(false)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}

      {scopeEdit &&
        (() => {
          // resolved live, so a deleted room simply closes the dropdown
          const room = state.rooms.find((r) => r.id === scopeEdit.id)
          if (!room) return null
          return (
            <ScopeDropdown
              anchor={scopeEdit.anchor}
              klasses={state.klasses}
              value={scopeDraft}
              onChange={setScopeDraft}
              onClose={closeScope}
            />
          )
        })()}
    </section>
  )
}
