import { useState } from 'react'
import { Seats, TopBar } from '../components'
import { roomVars } from '../roomColor'
import { HOME_COLOR } from '../roomColor'
import { book, canBook, occupancy, unbook } from '../store'
import { useBoard } from '../useBoard'
import type { CSSProperties } from 'react'

const homeVars = { '--accent': HOME_COLOR.accent, '--tint': HOME_COLOR.tint } as CSSProperties

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
      <TopBar title={`${klass.emoji ? `${klass.emoji} ` : ''}Klasse ${klass.name}`} />

      <div className="tiles">
        {kids.map((kid) => {
          const room = state.rooms.find((r) => r.id === kid.currentRoomId)
          return (
            <button
              key={kid.id}
              className="tile"
              aria-pressed={kid.id === selectedKidId}
              onClick={() => setSelectedKidId(kid.id === selectedKidId ? null : kid.id)}
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

      {selectedKid && (
        <div className="overlay" onClick={() => setSelectedKidId(null)}>
          <div className="picker" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelectedKidId(null)} aria-label="Schließen">
              ✕
            </button>
            <h2>
              Wohin gehst du, {selectedKid.symbol} {selectedKid.name}?
            </h2>
            <div className="tiles">
              <button
                className="tile room-tile"
                style={homeVars}
                disabled={selectedKid.currentRoomId === null}
                onClick={() => {
                  unbook(selectedKid.id)
                  setSelectedKidId(null)
                }}
              >
                <span className="emoji">🏠</span>
                <span className="name">Eigenes Klassenzimmer</span>
              </button>
              {state.rooms
                .filter((r) => r.scope === 'all' || r.scope === klassId)
                .map((room) => {
                  const check = canBook(selectedKid, room, state)
                  const here = selectedKid.currentRoomId === room.id
                  return (
                    <button
                      key={room.id}
                      className="tile room-tile"
                      style={roomVars(room)}
                      disabled={here || !check.ok}
                      onClick={() => {
                        const result = book(selectedKid.id, room.id)
                        if (result.ok) setSelectedKidId(null)
                      }}
                    >
                      <span className="emoji">{room.emoji}</span>
                      <span className="name">{room.name}</span>
                      {here ? (
                        <span className="reason">Du bist schon hier</span>
                      ) : check.ok ? (
                        <Seats capacity={room.capacity} occupied={occupancy(room.id, state)} />
                      ) : (
                        <span className="reason">{check.reason}</span>
                      )}
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}

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
