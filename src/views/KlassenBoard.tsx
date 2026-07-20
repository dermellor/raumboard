import { useState } from 'react'
import { book, canBook, freeSlots, occupancy, unbook } from '../store'
import { useBoard } from '../useBoard'

export function KlassenBoard({ klassId }: { klassId: string }) {
  const state = useBoard()
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null)

  const klass = state.klasses.find((c) => c.id === klassId)
  if (!klass) return <main>Klasse nicht gefunden. <a href="#/">Zur Übersicht</a></main>

  const kids = state.kids.filter((k) => k.klassId === klassId)
  const selectedKid = kids.find((k) => k.id === selectedKidId) ?? null
  const roomName = (roomId: string | null) => {
    if (roomId === null) return '🏠 Klassenzimmer'
    const room = state.rooms.find((r) => r.id === roomId)
    return room ? `${room.emoji} ${room.name}` : '?'
  }

  return (
    <main>
      <p><a href="#/">← Übersicht</a></p>
      <h1>Klasse {klass.name}</h1>
      <p>Tippe auf ein Kind, dann auf den Raum.</p>

      <div className="tiles">
        {kids.map((kid) => (
          <button
            key={kid.id}
            aria-pressed={kid.id === selectedKidId}
            onClick={() => setSelectedKidId(kid.id === selectedKidId ? null : kid.id)}
          >
            <div>{kid.symbol}</div>
            <div>{kid.name}</div>
            <small>{roomName(kid.currentRoomId)}</small>
          </button>
        ))}
      </div>

      {selectedKid && (
        <section>
          <h2>
            Wohin geht {selectedKid.symbol} {selectedKid.name}?
          </h2>
          <div className="tiles">
            <button
              disabled={selectedKid.currentRoomId === null}
              onClick={() => {
                unbook(selectedKid.id)
                setSelectedKidId(null)
              }}
            >
              <div>🏠</div>
              <div>Eigenes Klassenzimmer</div>
            </button>
            {state.rooms
              .filter((r) => r.scope === 'all' || r.scope === klassId)
              .map((room) => {
                const check = canBook(selectedKid, room, state)
                const here = selectedKid.currentRoomId === room.id
                return (
                  <button
                    key={room.id}
                    disabled={here || !check.ok}
                    onClick={() => {
                      const result = book(selectedKid.id, room.id)
                      if (result.ok) setSelectedKidId(null)
                    }}
                  >
                    <div>{room.emoji}</div>
                    <div>{room.name}</div>
                    <small>
                      {here
                        ? 'ist schon hier'
                        : check.ok
                          ? `${freeSlots(room, state)} von ${room.capacity} frei`
                          : check.reason}
                    </small>
                  </button>
                )
              })}
          </div>
        </section>
      )}

      <h2>Wo sind wir gerade?</h2>
      <ul>
        {state.rooms
          .filter((r) => kids.some((k) => k.currentRoomId === r.id))
          .map((r) => (
            <li key={r.id}>
              {r.emoji} {r.name} ({occupancy(r.id, state)} von {r.capacity}):{' '}
              {kids
                .filter((k) => k.currentRoomId === r.id)
                .map((k) => `${k.symbol} ${k.name}`)
                .join(', ')}
            </li>
          ))}
      </ul>
    </main>
  )
}
