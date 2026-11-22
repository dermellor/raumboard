import { Ban, CircleCheck, Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Klass, Room, TimeWindow } from '../../types'
import { EmojiButton } from '../../EmojiButton'
import { Symbol } from '../../Symbol'
import { occupancy } from '../../store'
import { addRoom, removeRoom, updateRoom } from '../../store'
import { useBoard, useMeta } from '../../useBoard'
import { canManageRooms } from '../../roomPermissions'
import { Drawer, DrawerTabs } from '../../Drawer'
import { NameField, ScopeRows } from './editing'

/** Which classes may book a room, as one label: "alle" or the class names. */
function scopeLabel(scope: Room['scope'], klasses: Klass[]): string {
  if (scope === 'all') return 'alle'
  return scope.map((id) => klasses.find((c) => c.id === id)?.name ?? id).join(', ')
}

/** The days of a window, short: "Mo, Do". */
const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function windowDays(w: TimeWindow): string {
  return w.days.map((d) => DAY_NAMES[d - 1]).join(', ')
}

/** "immer" or the windows as one short label, e.g. "Mo, Do 14:30–16:00". */
function windowsLabel(windows: Room['windows']): string {
  if (!windows?.length) return 'immer'
  return windows.map((w) => `${windowDays(w)} ${w.start}–${w.end}`).join('; ')
}

type RoomTab = 'allgemein' | 'klassen' | 'zeiten'

const ROOM_TABS: readonly { id: RoomTab; label: string }[] = [
  { id: 'allgemein', label: 'Allgemein' },
  { id: 'klassen', label: 'Klassen' },
  { id: 'zeiten', label: 'Zeiten' },
]

/**
 * The one editing surface for a room: a drawer over the table, grouped into
 * thematic tabs (general, classes, times) so each stay is short and scannable.
 * Changes commit immediately; the time windows work on a draft and save as one
 * update (an invalid window is never written). The status stays in the table:
 * a property edits either in the table or in the drawer, never both.
 */
function RoomDrawer({ room, onClose }: { room: Room; onClose: () => void }) {
  const state = useBoard()
  const meta = useMeta()
  const [tab, setTab] = useState<RoomTab>('allgemein')
  const [timesDraft, setTimesDraft] = useState<TimeWindow[]>(
    room.windows?.map((w) => ({ ...w, days: [...w.days] })) ?? [],
  )
  // keep the draft in sync when the room changes underneath (live updates);
  // window edits from this draft itself must not re-trigger it, so it keys on
  // the room identity, not on the windows payload
  useEffect(() => {
    setTimesDraft(room.windows?.map((w) => ({ ...w, days: [...w.days] })) ?? [])
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])
  const timesInvalid = timesDraft.some(
    (w) => !w.days.length || !w.start || !w.end || w.start >= w.end,
  )

  const patchWindow = (i: number, patch: Partial<TimeWindow>) =>
    setTimesDraft(timesDraft.map((w, j) => (j === i ? { ...w, ...patch } : w)))
  const toggleDay = (i: number, day: number) => {
    const days = timesDraft[i].days.includes(day)
      ? timesDraft[i].days.filter((d) => d !== day)
      : [...timesDraft[i].days, day]
    patchWindow(i, { days: days.sort((a, b) => a - b) })
  }

  return (
    <Drawer
      title={
        <>
          <Symbol value={room.emoji} /> {room.name}
        </>
      }
      onClose={onClose}
      footer={
        canManageRooms(meta) ? (
          <button
            className="add danger"
            onClick={() => {
              if (confirm(`Raum „${room.name}" löschen? Eingebuchte Kinder gehen zurück in die Klasse.`)) {
                removeRoom(room.id)
                onClose()
              }
            }}
          >
            <Trash2 /> Raum löschen
          </button>
        ) : undefined
      }
    >
      <DrawerTabs tabs={ROOM_TABS} active={tab} onChange={setTab} label="Raum bearbeiten" />

        {tab === 'allgemein' && (
          <>
            <div className="field">
              <label>Symbol</label>
              <EmojiButton
                value={room.emoji}
                label={`Emoji für ${room.name}`}
                onChange={(emoji) => updateRoom(room.id, { emoji })}
              />
            </div>
            <div className="field">
              <label htmlFor={`room-name-${room.id}`}>Name</label>
              <NameField
                value={room.name}
                label={`Name von ${room.name}`}
                onCommit={(name) => updateRoom(room.id, { name })}
              />
            </div>
            <div className="field">
              <label htmlFor={`room-capacity-${room.id}`}>Kapazität</label>
              <input
                id={`room-capacity-${room.id}`}
                type="number"
                min={0}
                value={room.capacity}
                style={{ width: '5em' }}
                onChange={(e) => updateRoom(room.id, { capacity: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <div className="field">
              <label htmlFor={`room-board-${room.id}`}>Anzeige auf den Tafeln</label>
              <select
                id={`room-board-${room.id}`}
                value={room.boardVisibility ?? 'always'}
                onChange={(e) =>
                  updateRoom(room.id, {
                    boardVisibility: e.target.value === 'open-only' ? 'open-only' : 'always',
                  })
                }
              >
                <option value="always">Immer anzeigen</option>
                <option value="open-only">Nur anzeigen, wenn geöffnet</option>
              </select>
            </div>
          </>
        )}

        {tab === 'klassen' && (
          <>
            <p className="hint">
              Für welche Klassen der Lernort buchbar ist. Mit „Alle" bleibt er für die ganze
              Schule offen.
            </p>
            <div className="field field-scope">
              <div className="scope-inline">
                <ScopeRows
                  klasses={state.klasses}
                  value={room.scope}
                  onChange={(scope) => {
                    // "keine Klasse" is not a valid scope; the empty selection
                    // between two clicks is simply not written
                    if (scope === 'all' || scope.length > 0) updateRoom(room.id, { scope })
                  }}
                />
              </div>
            </div>
          </>
        )}

        {tab === 'zeiten' && (
          <>
            <p className="hint">
              Ein Lernort mit Zeitfenstern ist nur an diesen Wochentagen und Uhrzeiten buchbar
              (z. B. eine AG). Ohne Zeitfenster ist er immer verfügbar.
            </p>
            {timesDraft.map((w, i) => (
              <div key={i} className="field window-row">
                <div className="day-toggles" role="group" aria-label="Wochentage">
                  {DAY_NAMES.map((name, d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={w.days.includes(d + 1)}
                      className={w.days.includes(d + 1) ? 'day on' : 'day'}
                      onClick={() => toggleDay(i, d + 1)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  aria-label="von"
                  value={w.start}
                  onChange={(e) => patchWindow(i, { start: e.target.value })}
                />
                <span>bis</span>
                <input
                  type="time"
                  aria-label="bis"
                  value={w.end}
                  onChange={(e) => patchWindow(i, { end: e.target.value })}
                />
                <button
                  className="add danger"
                  aria-label="Zeitfenster entfernen"
                  onClick={() => setTimesDraft(timesDraft.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="add"
              onClick={() => setTimesDraft([...timesDraft, { days: [1], start: '13:00', end: '14:30' }])}
            >
              <Plus /> Zeitfenster hinzufügen
            </button>
            <div className="field">
              <button
                className="primary"
                disabled={
                  timesInvalid ||
                  JSON.stringify(timesDraft) === JSON.stringify(room.windows ?? [])
                }
                onClick={() => updateRoom(room.id, { windows: timesDraft })}
              >
                Zeiten speichern
              </button>
            </div>
          </>
        )}
      </Drawer>
  )
}

/** The same drawer in create mode: one anlegen form instead of a second modal. */
function NewRoomDrawer({ onClose }: { onClose: () => void }) {
  const state = useBoard()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🚪')
  const [capacity, setCapacity] = useState(4)
  const [scope, setScope] = useState<Room['scope']>('all')

  return (
    <Drawer title="Raum hinzufügen" onClose={onClose}>
        <div className="field">
          <label>Symbol</label>
          <EmojiButton value={emoji} label="Emoji für neuen Raum" onChange={setEmoji} />
        </div>
        <div className="field">
          <label htmlFor="room-name-new">Name</label>
          <input
            id="room-name-new"
            placeholder="z.B. Leseecke"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="room-capacity-new">Kapazität</label>
          <input
            id="room-capacity-new"
            type="number"
            min={0}
            value={capacity}
            style={{ width: '5em' }}
            onChange={(e) => setCapacity(Math.max(0, Number(e.target.value)))}
          />
        </div>
        <div className="field field-scope">
          <label>Für</label>
          <div className="scope-inline">
            <ScopeRows klasses={state.klasses} value={scope} onChange={setScope} />
          </div>
        </div>
        <div className="field">
          <button
            className="primary"
            disabled={!name.trim() || (scope !== 'all' && scope.length === 0)}
            onClick={() => {
              addRoom(name.trim(), emoji || '🚪', capacity, scope)
              onClose()
            }}
          >
            anlegen
          </button>
        </div>
    </Drawer>
  )
}

/**
 * The rooms overview: one compact row per room. Editing (pencil, admins only)
 * opens the drawer; the status column keeps the open/close toggle inline
 * because it is the everyday operation.
 */
export function RaeumePage() {
  const state = useBoard()
  const meta = useMeta()
  // the room being edited in the drawer; "new" means the create form
  const [drawer, setDrawer] = useState<{ kind: 'edit'; id: string } | { kind: 'new' } | null>(null)
  const drawerRoom =
    drawer?.kind === 'edit'
      ? state.rooms.find((r) => r.id === drawer.id)
      : undefined
  // a deleted room (or a live update removing it) simply closes the drawer
  useEffect(() => {
    if (drawer?.kind === 'edit' && !drawerRoom) setDrawer(null)
  }, [drawer, drawerRoom])

  return (
    <section>
      <button className="add-narrow" onClick={() => setDrawer({ kind: 'new' })}>
        <Plus /> Raum hinzufügen
      </button>
      <div className="rooms-table-wrap">
        <table className="rooms-table">
        <thead>
          <tr>
            <th>Raum</th><th className="col-kap">Kapazität</th><th className="col-belegt">Belegt</th><th className="col-fuer">Für</th><th className="col-times">Zeiten</th><th className="col-anzeige">Anzeige auf den Tafeln</th><th>Status</th>
            {/* the + and the pencil share the last column: one flush-right slot */}
            <th className="th-add">
              <button className="add" aria-label="Raum hinzufügen" onClick={() => setDrawer({ kind: 'new' })}>
                <Plus />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {state.rooms.map((r) => (
            <tr key={r.id} className={`room-row${r.isOpen ? '' : ' closed'}`}>
              <td className="cell-name">
                <div className="cell-name-inner">
                  <Symbol className="emoji" value={r.emoji} />{' '}
                  <span className="room-name">{r.name}</span>
                </div>
              </td>
              <td className="col-kap">{r.capacity}</td>
              <td className="col-belegt">
                <span className="cell-label">Belegt</span>
                {occupancy(r.id, state)}/{r.capacity}
              </td>
              <td className="col-fuer">{scopeLabel(r.scope, state.klasses)}</td>
              <td className="col-times">
                {windowsLabel(r.windows)} <Clock className="icon-soft" size={16} />
              </td>
              <td className="col-anzeige">{r.boardVisibility === 'open-only' ? 'Nur wenn geöffnet' : 'Immer'}</td>
              <td>
                <button
                  className="toggle"
                  title={r.isOpen ? 'Raum schließen' : 'Raum öffnen'}
                  onClick={() => updateRoom(r.id, { isOpen: !r.isOpen })}
                >
                  {r.isOpen ? (
                    <>
                      <Ban className="icon-amber" /> <span className="toggle-label">Schließen</span>
                    </>
                  ) : (
                    <>
                      <CircleCheck className="icon-green" /> <span className="toggle-label">Öffnen</span>
                    </>
                  )}
                </button>
              </td>
              {meta.isAdmin && (
                <td className="td-edit">
                  <button
                    className="row-edit"
                    aria-label={`Raum ${r.name} bearbeiten`}
                    onClick={() => setDrawer({ kind: 'edit', id: r.id })}
                  >
                    <Pencil />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {drawer?.kind === 'new' && <NewRoomDrawer onClose={() => setDrawer(null)} />}
      {drawerRoom && <RoomDrawer room={drawerRoom} onClose={() => setDrawer(null)} />}
    </section>
  )
}
