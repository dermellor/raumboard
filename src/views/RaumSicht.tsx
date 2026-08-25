import { useState } from 'react'
import { Seats, TopBar } from '../components'
import { PinGate } from '../PinGate'
import { roomVars } from '../roomColor'
import { RoomPicker } from '../RoomPicker'
import { occupancy } from '../store'
import { useBoard, useMeta } from '../useBoard'

export function RaumSicht({ roomId }: { roomId: string }) {
  const state = useBoard()
  const meta = useMeta()
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null)
  const [showPin, setShowPin] = useState(false)

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
        <span className="emoji">{room.emoji}</span>
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
                        if (!meta.canOperate) return setShowPin(true)
                        setSelectedKidId(k.id === selectedKidId ? null : k.id)
                      }}
                    >
                      <span className="emoji">{k.symbol}</span>
                      <span className="name">{k.name}</span>
                    </button>
                  ))}
              </div>
            </section>
          ))
      )}

      {showPin && <PinGate onClose={() => setShowPin(false)} />}
      {selectedKid && <RoomPicker kid={selectedKid} onClose={() => setSelectedKidId(null)} />}
    </main>
  )
}
