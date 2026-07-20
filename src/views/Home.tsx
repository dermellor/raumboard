import { Seats } from '../components'
import { roomVars } from '../roomColor'
import { occupancy } from '../store'
import { useBoard } from '../useBoard'

export function Home() {
  const state = useBoard()

  return (
    <main>
      <div className="topbar">
        <h1>🏫 Lernraum-Board</h1>
        <a href="#/admin">⚙️ Verwaltung</a>
      </div>

      <h2>Klassen</h2>
      <div className="launcher">
        {state.klasses.map((c) => {
          const kids = state.kids.filter((k) => k.klassId === c.id)
          const away = kids.filter((k) => k.currentRoomId !== null).length
          return (
            <a key={c.id} href={`#/klasse/${c.id}`}>
              <div className="tile">
                <span className="emoji">{c.emoji || kids[0]?.symbol || '🚪'}</span>
                <span className="name">Klasse {c.name}</span>
                <span className="count">
                  {away > 0 ? `${away} von ${kids.length} unterwegs` : `${kids.length} Kinder`}
                </span>
              </div>
            </a>
          )
        })}
      </div>

      <h2>Lernräume</h2>
      <div className="launcher">
        {state.rooms.map((r) => (
          <a key={r.id} href={`#/raum/${r.id}`}>
            <div className="tile room-tile" style={roomVars(r)}>
              <span className="emoji">{r.emoji}</span>
              <span className="name">{r.name}</span>
              {r.isOpen ? (
                <Seats capacity={r.capacity} occupied={occupancy(r.id, state)} />
              ) : (
                <span className="reason">heute geschlossen</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </main>
  )
}
