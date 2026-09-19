import { useState } from 'react'
import { Seats, TopBar } from '../components'
import { displayName } from '../displayName'
import { roomVars } from '../roomColor'
import { Symbol } from '../Symbol'
import { RoomPicker } from '../RoomPicker'
import { occupancy } from '../store'
import { useBoard } from '../useBoard'

export function RaumSicht({ roomId }: { roomId: string }) {
  const state = useBoard()
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null)

  const room = state.rooms.find((r) => r.id === roomId)
  if (!room)
    return (
      <main>
        <TopBar title="Raum nicht gefunden" />
      </main>
    )

  const expected = state.kids.filter((k) => k.currentRoomId === roomId)
  const selectedKid = expected.find((k) => k.id === selectedKidId) ?? null
  const occ = occupancy(roomId, state)

  return (
    <main>
      <TopBar title="" />
      <div className="room-head" style={roomVars(room)}>
        <Symbol className="emoji" value={room.emoji} />
        <h1>{room.name}</h1>
        <Seats capacity={room.capacity} occupied={occ} />
        {!room.isOpen && <span className="badge-closed">heute geschlossen</span>}
      </div>

      {expected.length === 0 ? (
        <h2>Hier wird gerade niemand erwartet.</h2>
      ) : (
        state.klasses
          .filter((c) => expected.some((k) => k.klassId === c.id))
          .map((c) => (
            <section key={c.id}>
              <h2>Aus Klasse {c.name}:</h2>
              <div className="tiles">
                {expected
                  .filter((k) => k.klassId === c.id)
                  .map((k) => (
                    <button
                      key={k.id}
                      className="tile"
                      aria-pressed={k.id === selectedKidId}
                      onClick={() => {
                        setSelectedKidId(k.id === selectedKidId ? null : k.id)
                      }}
                    >
                      <Symbol className="emoji" value={k.symbol} />
                      <span className="name">{displayName(k.name, state.kids)}</span>
                    </button>
                  ))}
              </div>
            </section>
          ))
      )}

      {selectedKid && <RoomPicker kid={selectedKid} onClose={() => setSelectedKidId(null)} />}
    </main>
  )
}
