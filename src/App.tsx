import { Lock, Sprout } from 'lucide-react'
import { useRoute } from './router'
import { lockDevice, reseed } from './store'
import { useMeta } from './useBoard'
import { Admin } from './views/Admin'
import { Home } from './views/Home'
import { KlassenBoard } from './views/KlassenBoard'
import { RaumSicht } from './views/RaumSicht'

export function App() {
  const route = useRoute()
  const meta = useMeta()

  if (!meta.ready)
    return (
      <main>
        <p>Lädt …</p>
      </main>
    )

  let view
  switch (route.view) {
    case 'klasse':
      view = <KlassenBoard klassId={route.id} />
      break
    case 'raum':
      view = <RaumSicht roomId={route.id} />
      break
    case 'admin':
      view = <Admin />
      break
    default:
      view = <Home />
  }

  return (
    <>
      {view}
      {/* public demo: everyone may undo everyone's mess, no login needed */}
      {meta.ephemeral && (
        <button
          className="demo-reset"
          onClick={() => {
            if (confirm('Demo auf den Ausgangszustand zurücksetzen?')) reseed()
          }}
        >
          <Sprout /> Demo zurücksetzen
        </button>
      )}
      {/* local dev only: clear the session so the PIN gate can be tested */}
      {meta.dev && meta.canOperate && (
        <button
          className="dev-lock"
          title="Nur lokal: Admin-Session und Geräte-PIN zurücksetzen, um die PIN-Eingabe zu testen"
          onClick={() => void lockDevice()}
        >
          <Lock /> Gerät sperren (Dev)
        </button>
      )}
    </>
  )
}
