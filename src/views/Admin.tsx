import { useState } from 'react'
import {
  addKid, addKlass, addRoom, occupancy, removeKid, removeKlass, removeRoom,
  reseed, reset, updateKid, updateKlass, updateRoom,
} from '../store'
import { EmojiButton } from '../EmojiButton'
import { useBoard } from '../useBoard'

export function Admin() {
  const state = useBoard()
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
        <a href="#/">🏫 Start</a>
        <h1>⚙️ Verwaltung</h1>
      </div>

      <section>
        <h2>Tagesaktionen</h2>
        <button
          className="danger"
          onClick={() => {
            if (confirm('Alle Kinder zurück in ihre Klassenzimmer buchen?')) reset()
          }}
        >
          🔄 Alle zurück in die Klasse (Reset)
        </button>{' '}
        <button
          className="danger"
          onClick={() => {
            if (confirm('Alles verwerfen und die Beispieldaten neu laden?')) reseed()
          }}
        >
          🌱 Beispieldaten neu laden
        </button>
      </section>

      <section>
        <h2>Räume</h2>
        <table>
          <thead>
            <tr>
              <th>Raum</th><th>Kapazität</th><th>Belegt</th><th>Für</th><th>Status</th><th></th>
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
                  <button onClick={() => updateRoom(r.id, { isOpen: !r.isOpen })}>
                    {r.isOpen ? 'offen → schließen' : 'geschlossen → öffnen'}
                  </button>
                </td>
                <td>
                  <button
                    className="danger"
                    onClick={() => {
                      if (confirm(`Raum „${r.name}" löschen? Eingebuchte Kinder gehen zurück in die Klasse.`))
                        removeRoom(r.id)
                    }}
                  >
                    löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Raum hinzufügen</h3>
        <EmojiButton value={roomEmoji} label="Emoji für neuen Raum" onChange={setRoomEmoji} />
        <input placeholder="Name" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
        <input
          type="number" min={0} value={roomCapacity} style={{ width: '4em' }}
          onChange={(e) => setRoomCapacity(Math.max(0, Number(e.target.value)))}
        />
        <select value={roomScope} onChange={(e) => setRoomScope(e.target.value)}>
          <option value="all">für alle</option>
          {state.klasses.map((c) => (
            <option key={c.id} value={c.id}>nur Klasse {c.name}</option>
          ))}
        </select>
        <button
          disabled={!roomName.trim()}
          onClick={() => {
            addRoom(roomName.trim(), roomEmoji || '🚪', roomCapacity, roomScope)
            setRoomName('')
          }}
        >
          anlegen
        </button>
      </section>

      <section>
        <h2>Klassen</h2>
        <table>
          <thead>
            <tr>
              <th>Klasse</th><th>Kinder</th><th></th>
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
                <td>
                  <button
                    className="danger"
                    onClick={() => {
                      if (confirm(`Klasse ${c.name} samt allen Kindern und klassengebundenen Räumen löschen?`))
                        removeKlass(c.id)
                    }}
                  >
                    löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <EmojiButton value={klassEmoji} label="Emoji für neue Klasse" onChange={setKlassEmoji} />
        <input placeholder="z.B. 1C" value={klassName} onChange={(e) => setKlassName(e.target.value)} />
        <button
          disabled={!klassName.trim()}
          onClick={() => {
            addKlass(klassName.trim(), klassEmoji || undefined)
            setKlassName('')
          }}
        >
          Klasse anlegen
        </button>
      </section>

      <section>
        <h2>Kinder</h2>
        <h3>Kind hinzufügen</h3>
        <EmojiButton value={kidSymbol} label="Symbol für neues Kind" onChange={setKidSymbol} />
        <input placeholder="Name (z.B. Mina K.)" value={kidName} onChange={(e) => setKidName(e.target.value)} />
        <select value={kidKlass} onChange={(e) => setKidKlass(e.target.value)}>
          <option value="">Klasse wählen…</option>
          {state.klasses.map((c) => (
            <option key={c.id} value={c.id}>Klasse {c.name}</option>
          ))}
        </select>
        <button
          disabled={!kidName.trim() || !kidKlass}
          onClick={() => {
            addKid(kidKlass, kidSymbol || '⭐', kidName.trim())
            setKidName('')
          }}
        >
          anlegen
        </button>

        {state.klasses.map((c) => (
          <details key={c.id}>
            <summary>Klasse {c.name}</summary>
            <table>
              <thead>
                <tr>
                  <th>Kind</th><th>Klasse</th><th></th>
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
                      <td>
                        <button
                          className="danger"
                          onClick={() => {
                            if (confirm(`${k.name} löschen?`)) removeKid(k.id)
                          }}
                        >
                          löschen
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        ))}
      </section>
    </main>
  )
}
