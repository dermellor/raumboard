import { useRoute } from './router'
import { Admin } from './views/Admin'
import { Home } from './views/Home'
import { KlassenBoard } from './views/KlassenBoard'
import { RaumSicht } from './views/RaumSicht'

export function App() {
  const route = useRoute()
  switch (route.view) {
    case 'klasse':
      return <KlassenBoard klassId={route.id} />
    case 'raum':
      return <RaumSicht roomId={route.id} />
    case 'admin':
      return <Admin />
    default:
      return <Home />
  }
}
