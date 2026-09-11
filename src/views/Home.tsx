import { LogIn, LogOut, Settings } from 'lucide-react'
import { useState } from 'react'
import { Seats } from '../components'
import { DayEndReset } from '../DayEndReset'
import { PasswordGate } from '../PasswordGate'
import { roomVars } from '../roomColor'
import { Symbol } from '../Symbol'
import { logout, occupancy } from '../store'
import { useBoard, useMeta } from '../useBoard'

export function Home() {
  const state = useBoard()
  const meta = useMeta()
  const [gate, setGate] = useState(false)
  const anyAway = state.kids.some((k) => k.currentRoomId !== null)

  return (
    <main>
      <div className="topbar">
        <h1>
          <Symbol value="🏫" /> {meta.mode === 'api' && meta.schoolName ? meta.schoolName : 'Raumboard'}
        </h1>
      </div>

      <h2>Klassen</h2>
      <div className="launcher">
        {state.klasses.map((c) => {
          const kids = state.kids.filter((k) => k.klassId === c.id)
          const away = kids.filter((k) => k.currentRoomId !== null).length
          return (
            <a key={c.id} href={`#/klasse/${c.id}`}>
              <div className="tile">
                <Symbol className="emoji" value={c.emoji || kids[0]?.symbol || '🚪'} />
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
              <Symbol className="emoji" value={r.emoji} />
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

      {/* what the adults use, below what the children tap all day */}
      <div className="grown-ups">
        {/* nothing to put back when every kid is in their classroom */}
        {anyAway && <DayEndReset />}
        <a href="#/verwaltung/raeume">
          <Settings className="icon-soft" /> Verwaltung
        </a>
        {/* the school's account: needed for the import and for the credentials,
            so it is signed in and out here rather than inside the Verwaltung */}
        {meta.mode === 'api' &&
          (meta.isAdmin ? (
            <button onClick={() => void logout()}>
              <LogOut className="icon-soft" /> Abmelden
            </button>
          ) : (
            <button onClick={() => setGate(true)}>
              <LogIn className="icon-soft" /> Anmelden
            </button>
          ))}
      </div>

      {gate && (
        <PasswordGate
          onSuccess={() => setGate(false)}
          onClose={() => setGate(false)}
        />
      )}
    </main>
  )
}
