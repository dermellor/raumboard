import { useState } from 'react'
import { TopBar } from '../components'
import { PinGate } from '../PinGate'
import { homeVars, roomVars } from '../roomColor'
import { RoomPicker } from '../RoomPicker'
import { useBoard, useMeta } from '../useBoard'

export function KlassenBoard({ klassId }: { klassId: string }) {
  const state = useBoard()
  const meta = useMeta()
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null)
  const [showPin, setShowPin] = useState(false)

  const klass = state.klasses.find((c) => c.id === klassId)
  if (!klass)
    return (
      <main>
        <TopBar title="Klasse nicht gefunden" />
      </main>
    )

  const kids = state.kids.filter((k) => k.klassId === klassId)
  const selectedKid = kids.find((k) => k.id === selectedKidId) ?? null

  return (
    <main>
      <TopBar title={`${klass.emoji ? `${klass.emoji} ` : ''}Klasse ${klass.name}`} />

      <div className="tiles">
        {kids.map((kid) => {
          const room = state.rooms.find((r) => r.id === kid.currentRoomId)
          return (
            <button
              key={kid.id}
              className="tile"
              aria-pressed={kid.id === selectedKidId}
              onClick={() => {
                if (!meta.canOperate) return setShowPin(true)
                setSelectedKidId(kid.id === selectedKidId ? null : kid.id)
              }}
            >
              <span className="emoji">{kid.symbol}</span>
              <span className="name">{kid.name}</span>
              {room ? (
                <span className="where" style={roomVars(room)}>
                  {room.emoji} {room.name}
                </span>
              ) : (
                <span className="where" style={homeVars}>
                  🏠 Klasse
                </span>
              )}
            </button>
          )
        })}
      </div>

      {showPin && <PinGate onClose={() => setShowPin(false)} />}
      {selectedKid && <RoomPicker kid={selectedKid} onClose={() => setSelectedKidId(null)} />}

      <h2>Unterwegs sind gerade:</h2>
      <div className="tiles">
        {state.rooms
          .filter((r) => kids.some((k) => k.currentRoomId === r.id))
          .map((r) => (
            <div key={r.id} className="tile room-tile" style={roomVars(r)}>
              <span className="emoji">{r.emoji}</span>
              <span className="name">{r.name}</span>
              <span>
                {kids
                  .filter((k) => k.currentRoomId === r.id)
                  .map((k) => `${k.symbol} ${k.name}`)
                  .join(', ')}
              </span>
            </div>
          ))}
        {kids.every((k) => k.currentRoomId === null) && <p className="count">Alle sind im Klassenzimmer.</p>}
      </div>
    </main>
  )
}
