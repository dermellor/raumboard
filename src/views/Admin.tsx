import { DoorClosed, DoorOpen, Plus, RotateCcw, School, Settings, Sprout, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  addKid, addKlass, addRoom, occupancy, removeKid, removeKlass, removeRoom,
  reseed, reset, updateKid, updateKlass, updateRoom,
} from '../store'
import { EmojiButton } from '../EmojiButton'
import { Modal } from '../components'
import { useBoard } from '../useBoard'

type AdminModal = 'room' | 'klass' | 'kid' | null

export function Admin() {
  const state = useBoard()
  const [modal, setModal] = useState<AdminModal>(null)
  const [roomName, setRoomName] = useState('')
  const [roomEmoji, setRoomEmoji] = useState('🚪')
  const [roomCapacity, setRoomCapacity] = useState(4)
  const [roomScope, setRoomScope] = useState('all')
  const [kidName, setKidName] = useState('')
  const [kidSymbol, setKidSymbol] = useState('⭐')
  const [kidKlass, setKidKlass] = useState('')
  const [klassName, setKlassName] = useState('')
  const [klassEmoji, setKlassEmoji] = useState('🚪')

  return (
    <main className="admin">
      <div className="topbar">
        <a href="#/">
          <School className="icon-accent" /> Start
        </a>
        <h1>
          <Settings className="icon-h1" /> Verwaltung
        </h1>
      </div>

      <section>
        <h2>Tagesaktionen</h2>
        <button
          className="danger"
          onClick={() => {
            if (confirm('Alle Kinder zurück in ihre Klassenzimmer buchen?')) reset()
          }}
        >
          <RotateCcw /> Alle zurück in die Klasse (Reset)
        </button>{' '}
        <button
          className="danger"
          onClick={() => {
            if (confirm('Alles verwerfen und die Beispieldaten neu laden?')) reseed()
          }}
        >
          <Sprout /> Beispieldaten neu laden
        </button>
      </section>

      <section>
        <h2>Räume</h2>
        <table>
          <thead>
            <tr>
              <th>Raum</th><th>Kapazität</th><th>Belegt</th><th>Für</th><th>Status</th>
              <th className="th-add">
                <button className="add" aria-label="Raum hinzufügen" onClick={() => setModal('room')}>
                  <Plus />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.rooms.map((r) => (
              <tr key={r.id}>
                <td>
                  <EmojiButton
                    value={r.emoji}
                    label={`Emoji für ${r.name}`}
                    onChange={(emoji) => updateRoom(r.id, { emoji })}
                  />{' '}
                  {r.name}
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
                <td>{r.scope === 'all' ? 'alle' : `Klasse ${state.klasses.find((c) => c.id === r.scope)?.name ?? r.scope}`}</td>
                <td>
                  <button className="toggle" onClick={() => updateRoom(r.id, { isOpen: !r.isOpen })}>
                    {r.isOpen ? (
                      <>
                        <DoorClosed className="icon-amber" /> Schließen
                      </>
                    ) : (
                      <>
                        <DoorOpen className="icon-green" /> Öffnen
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
      </section>

      <section>
        <h2>Klassen</h2>
        <table>
          <thead>
            <tr>
              <th>Klasse</th><th>Kinder</th>
              <th className="th-add">
                <button className="add" aria-label="Klasse hinzufügen" onClick={() => setModal('klass')}>
                  <Plus />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.klasses.map((c) => (
              <tr key={c.id}>
                <td>
                  <EmojiButton
                    value={c.emoji ?? ''}
                    label={`Emoji für Klasse ${c.name}`}
                    onChange={(emoji) => updateKlass(c.id, { emoji })}
                  />{' '}
                  Klasse {c.name}
                </td>
                <td>{state.kids.filter((k) => k.klassId === c.id).length}</td>
                <td className="td-right">
                  <button
                    className="add danger"
                    aria-label={`Klasse ${c.name} löschen`}
                    onClick={() => {
                      if (confirm(`Klasse ${c.name} samt allen Kindern und klassengebundenen Räumen löschen?`))
                        removeKlass(c.id)
                    }}
                  >
                    <Trash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Kinder</h2>
        {state.klasses.map((c) => (
          <details key={c.id}>
            <summary>Klasse {c.name}</summary>
            <table>
              <thead>
                <tr>
                  <th>Kind</th><th>Klasse</th>
                  <th className="th-add">
                    <button
                      className="add"
                      aria-label={`Kind in Klasse ${c.name} hinzufügen`}
                      onClick={() => {
                        setKidKlass(c.id)
                        setModal('kid')
                      }}
                    >
                      <Plus />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.kids
                  .filter((k) => k.klassId === c.id)
                  .map((k) => (
                    <tr key={k.id}>
                      <td>
                        <EmojiButton
                          value={k.symbol}
                          label={`Symbol für ${k.name}`}
                          onChange={(symbol) => updateKid(k.id, { symbol })}
                        />{' '}
                        {k.name}
                      </td>
                      <td>
                        <select
                          value={k.klassId}
                          onChange={(e) => updateKid(k.id, { klassId: e.target.value })}
                        >
                          {state.klasses.map((c2) => (
                            <option key={c2.id} value={c2.id}>Klasse {c2.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="td-right">
                        <button
                          className="add danger"
                          aria-label={`${k.name} löschen`}
                          onClick={() => {
                            if (confirm(`${k.name} löschen?`)) removeKid(k.id)
                          }}
                        >
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        ))}
      </section>

      {modal === 'room' && (
        <Modal title="Raum hinzufügen" onClose={() => setModal(null)}>
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
          <div className="field">
            <label htmlFor="room-scope">Für</label>
            <select id="room-scope" value={roomScope} onChange={(e) => setRoomScope(e.target.value)}>
              <option value="all">für alle</option>
              {state.klasses.map((c) => (
                <option key={c.id} value={c.id}>nur Klasse {c.name}</option>
              ))}
            </select>
          </div>
          <button
            disabled={!roomName.trim()}
            onClick={() => {
              addRoom(roomName.trim(), roomEmoji || '🚪', roomCapacity, roomScope)
              setRoomName('')
              setModal(null)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}

      {modal === 'klass' && (
        <Modal title="Klasse hinzufügen" onClose={() => setModal(null)}>
          <div className="field">
            <label>Symbol</label>
            <EmojiButton value={klassEmoji} label="Emoji für neue Klasse" onChange={setKlassEmoji} />
          </div>
          <div className="field">
            <label htmlFor="klass-name">Name</label>
            <input
              id="klass-name"
              placeholder="z.B. 1C"
              value={klassName}
              autoFocus
              onChange={(e) => setKlassName(e.target.value)}
            />
          </div>
          <button
            disabled={!klassName.trim()}
            onClick={() => {
              addKlass(klassName.trim(), klassEmoji || undefined)
              setKlassName('')
              setModal(null)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}

      {modal === 'kid' && (
        <Modal title="Kind hinzufügen" onClose={() => setModal(null)}>
          <div className="field">
            <label>Symbol</label>
            <EmojiButton value={kidSymbol} label="Symbol für neues Kind" onChange={setKidSymbol} />
          </div>
          <div className="field">
            <label htmlFor="kid-name">Name</label>
            <input
              id="kid-name"
              placeholder="z.B. Mina K."
              value={kidName}
              autoFocus
              onChange={(e) => setKidName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="kid-klass">Klasse</label>
            <select id="kid-klass" value={kidKlass} onChange={(e) => setKidKlass(e.target.value)}>
              <option value="">Klasse wählen…</option>
              {state.klasses.map((c) => (
                <option key={c.id} value={c.id}>Klasse {c.name}</option>
              ))}
            </select>
          </div>
          <button
            disabled={!kidName.trim() || !kidKlass}
            onClick={() => {
              addKid(kidKlass, kidSymbol || '⭐', kidName.trim())
              setKidName('')
              setModal(null)
            }}
          >
            anlegen
          </button>
        </Modal>
      )}
    </main>
  )
}
