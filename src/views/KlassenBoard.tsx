import { useState } from 'react'
import { TopBar } from '../components'
import { displayName } from '../displayName'
import { homeVars, roomVars } from '../roomColor'
import { Symbol } from '../Symbol'
import { RoomPicker } from '../RoomPicker'
import { useBoard } from '../useBoard'

export function KlassenBoard({ klassId }: { klassId: string }) {
  const state = useBoard()
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null)

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
      <TopBar
        title={
          <>
            {klass.emoji && <Symbol value={klass.emoji} />} Klasse {klass.name}
          </>
        }
      />

      <div className="tiles">
        {kids.map((kid) => {
          const room = state.rooms.find((r) => r.id === kid.currentRoomId)
          return (
            <button
              key={kid.id}
              className="tile"
              aria-pressed={kid.id === selectedKidId}
              onClick={() => {
                setSelectedKidId(kid.id === selectedKidId ? null : kid.id)
              }}
            >
              <Symbol className="emoji" value={kid.symbol} />
              <span className="name">{displayName(kid.name, state.kids)}</span>
              {room ? (
                <span className="where" style={roomVars(room)}>
                  <Symbol value={room.emoji} /> {room.name}
                </span>
              ) : (
                <span className="where" style={homeVars}>
                  <Symbol value="🏠" /> Klasse
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedKid && <RoomPicker kid={selectedKid} onClose={() => setSelectedKidId(null)} />}

      <h2>Unterwegs sind gerade:</h2>
      <div className="tiles">
        {state.rooms
          .filter((r) => kids.some((k) => k.currentRoomId === r.id))
          .map((r) => (
            <div key={r.id} className="tile room-tile" style={roomVars(r)}>
              <Symbol className="emoji" value={r.emoji} />
              <span className="name">{r.name}</span>
              <span>
                {kids
                  .filter((k) => k.currentRoomId === r.id)
                  .map((k) => `${k.symbol} ${displayName(k.name, state.kids)}`)
                  .join(', ')}
              </span>
            </div>
          ))}
        {kids.every((k) => k.currentRoomId === null) && <p className="count">Alle sind im Klassenzimmer.</p>}
      </div>
    </main>
  )
}
