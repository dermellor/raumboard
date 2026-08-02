import { Seats } from './components'
import { homeVars, roomVars } from './roomColor'
import { book, canBook, occupancy, unbook } from './store'
import { useBoard } from './useBoard'
import type { Kid } from './types'

/**
 * "Wohin gehst du?" overlay — used from the class board and the room view,
 * so kids can be (re)booked from either screen.
 */
export function RoomPicker({ kid, onClose }: { kid: Kid; onClose: () => void }) {
  const state = useBoard()

  return (
    <div className="overlay" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
        <h2>
          Wohin gehst du, {kid.symbol} {kid.name}?
        </h2>
        <div className="tiles">
          <button
            className="tile room-tile"
            style={homeVars}
            disabled={kid.currentRoomId === null}
            onClick={() => {
              unbook(kid.id)
              onClose()
            }}
          >
            <span className="emoji">🏠</span>
            <span className="name">Eigenes Klassenzimmer</span>
          </button>
          {state.rooms
            .filter((r) => r.scope === 'all' || r.scope === kid.klassId)
            .map((room) => {
              const check = canBook(kid, room, state)
              const here = kid.currentRoomId === room.id
              return (
                <button
                  key={room.id}
                  className="tile room-tile"
                  style={roomVars(room)}
                  disabled={here || !check.ok}
                  onClick={() => {
                    const result = book(kid.id, room.id)
                    if (result.ok) onClose()
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
  )
}
