import { occupancy } from '../store'
import { useBoard } from '../useBoard'

export function Home() {
  const state = useBoard()
  const out = state.kids.filter((k) => k.currentRoomId !== null).length

  return (
    <main>
      <h1>Lernraum-Board</h1>
      <p>
        {state.kids.length} Kinder, davon {out} in Lernräumen unterwegs.
      </p>

      <h2>Klassen</h2>
      <ul>
        {state.klasses.map((c) => {
          const kids = state.kids.filter((k) => k.klassId === c.id)
          const away = kids.filter((k) => k.currentRoomId !== null).length
          return (
            <li key={c.id}>
              <a href={`#/klasse/${c.id}`}>Klasse {c.name}</a> ({kids.length} Kinder, {away} unterwegs)
            </li>
          )
        })}
      </ul>

      <h2>Räume</h2>
      <ul>
        {state.rooms.map((r) => (
          <li key={r.id}>
            <a href={`#/raum/${r.id}`}>
              {r.emoji} {r.name}
            </a>{' '}
            — {occupancy(r.id, state)} von {r.capacity} belegt
            {!r.isOpen && ' (geschlossen)'}
          </li>
        ))}
      </ul>

      <h2>Verwaltung</h2>
      <p>
        <a href="#/admin">Admin-Bereich</a>
      </p>
    </main>
  )
}
