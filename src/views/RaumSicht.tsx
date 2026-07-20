import { occupancy } from '../store'
import { useBoard } from '../useBoard'

export function RaumSicht({ roomId }: { roomId: string }) {
  const state = useBoard()
  const room = state.rooms.find((r) => r.id === roomId)
  if (!room) return <main>Raum nicht gefunden. <a href="#/">Zur Übersicht</a></main>

  const expected = state.kids.filter((k) => k.currentRoomId === roomId)

  return (
    <main>
      <p><a href="#/">← Übersicht</a></p>
      <h1>
        {room.emoji} {room.name}
      </h1>
      <p>
        {occupancy(roomId, state)} von {room.capacity} Plätzen belegt
        {!room.isOpen && ' — Raum ist geschlossen'}
      </p>

      {expected.length === 0 ? (
        <p>Hier wird gerade niemand erwartet.</p>
      ) : (
        state.klasses
          .filter((c) => expected.some((k) => k.klassId === c.id))
          .map((c) => (
            <section key={c.id}>
              <h2>Klasse {c.name}</h2>
              <ul>
                {expected
                  .filter((k) => k.klassId === c.id)
                  .map((k) => (
                    <li key={k.id}>
                      {k.symbol} {k.name}
                    </li>
                  ))}
              </ul>
            </section>
          ))
      )}
    </main>
  )
}
