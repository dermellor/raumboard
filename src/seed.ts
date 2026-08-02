import type { BoardState, Kid, Klass, Room } from './types'

// Dummy data only — never real children's names (see AGENTS.md).
// Structure mirrors the school's original sheet: each class has a themed
// emoji set, kids are "first name + last-name initial".

const KLASS_THEMES: Record<string, string[]> = {
  '1A': ['🦊', '🐻', '🐺', '🐗', '🦌', '🐿️', '🦔', '🦝', '🐭', '🐰', '🐱', '🐶', '🐴', '🌲', '🌳', '🍄', '🌿', '🍃', '🌻', '🌼', '🌷', '🍎', '🍐', '🍓', '🍒', '🫐', '🍍'],
  '1B': ['🦁', '🐯', '🐘', '🦒', '🦓', '🦛', '🦏', '🐪', '🐫', '🐒', '🦍', '🦧', '🐊', '🐍', '🦎', '🐢', '🐧', '🦩', '🦜', '🦚', '🐆', '🐅', '🛖', '🌴', '🌵', '🥥', '🦂'],
  '2A': ['🐬', '🐳', '🐋', '🦈', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐚', '🧜', '🌊', '🏄', '🛶', '⛵', '🚢', '⚓', '🏖️', '🏝️', '🪸', '🐌', '🫧', '🐸', '🦭'],
  '2B': ['🐝', '🦋', '🐜', '🐞', '🐌', '🦗', '🕷️', '🕸️', '🦂', '🦟', '🐛', '🪲', '🪳', '🐸', '🌸', '🌺', '🪻', '🌾', '🪰', '🪱', '🍄', '🍀', '🌱', '🪴', '🌵', '🎋', '🌹'],
  '3A': ['☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '🌬️', '💨', '🌪️', '🌈', '🌡️', '🌙', '🌛', '🌟', '🌠', '🌌', '🪐', '🌍', '🌕', '🌖', '🌓', '☄️'],
  '3B': ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🫑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔'],
  '4A': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🏏', '⛳', '🏹', '🎣', '🥊', '🥋', '⛸️', '🎿', '🛷', '🛹', '🚲', '🛼', '🎳'],
  '4B': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛵', '🏍️', '🚲', '🚅', '🚂', '✈️', '🚀', '🛸', '🚁', '🚢', '⛴️', '🛳️', '🚤', '🛺'],
}

const FIRST_NAMES = [
  'Mina', 'Leo', 'Ayla', 'Jonas', 'Zara', 'Emil', 'Lina', 'Omar', 'Ida', 'Bruno',
  'Elif', 'Paul', 'Sana', 'Theo', 'Nele', 'Karim', 'Frida', 'Milo', 'Amina', 'Juri',
  'Tilda', 'Nuri', 'Greta', 'Samir', 'Lotte', 'Bela', 'Yara', 'Anton', 'Selin', 'Mats',
  'Ruth', 'Deniz', 'Clara', 'Josip', 'Meret', 'Ilyan', 'Paula', 'Tarik', 'Edda', 'Levin',
  'Sofia', 'Rasmus', 'Leyla', 'Oskar', 'Naomi', 'Henri', 'Aylin', 'Falk', 'Mira', 'Janusz',
  'Hedi', 'Kuno', 'Esra', 'Lasse', 'Vera', 'Timon', 'Alva', 'Rafik', 'Wanda', 'Piet',
]

const INITIALS = 'ABCDEFGHIJKLMNOPRSTUVWYZ'

const KLASS_NAMES = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']

function klassId(name: string): string {
  return name.toLowerCase()
}

function buildKids(): Kid[] {
  const kids: Kid[] = []
  KLASS_NAMES.forEach((klassName, k) => {
    const theme = KLASS_THEMES[klassName]
    for (let i = 0; i < theme.length; i++) {
      // deterministic but different name/initial combos per class
      const first = FIRST_NAMES[(k * 23 + i * 7) % FIRST_NAMES.length]
      const initial = INITIALS[(k * 11 + i * 5) % INITIALS.length]
      kids.push({
        id: `${klassId(klassName)}-${i + 1}`,
        klassId: klassId(klassName),
        symbol: theme[i],
        name: `${first} ${initial}.`,
        currentRoomId: null,
      })
    }
  })
  return kids
}

function buildRooms(): Room[] {
  const shared: Room[] = [
    { id: 'bibliothek', name: 'Bibliothek', emoji: '📚', capacity: 8, isOpen: true, scope: 'all' },
    { id: 'atelier-blau', name: 'Lernatelier (blau)', emoji: '🔵', capacity: 12, isOpen: true, scope: 'all' },
    { id: 'atelier-rot', name: 'Lernatelier (rot)', emoji: '🔴', capacity: 12, isOpen: true, scope: 'all' },
    { id: 'atelier-gruen', name: 'Lernatelier (grün)', emoji: '🟢', capacity: 12, isOpen: true, scope: 'all' },
    { id: 'foyer', name: 'Foyer', emoji: '🪑', capacity: 6, isOpen: true, scope: 'all' },
    { id: 'garten', name: 'Garten', emoji: '🌳', capacity: 10, isOpen: false, scope: 'all' },
  ]
  const flure: Room[] = KLASS_NAMES.map((name) => ({
    id: `flur-${klassId(name)}`,
    name: `Flur ${name}`,
    emoji: '🧩',
    capacity: 3,
    isOpen: true,
    scope: klassId(name),
  }))
  return [...shared, ...flure]
}

export function buildSeed(): BoardState {
  const klasses: Klass[] = KLASS_NAMES.map((name) => ({
    id: klassId(name),
    name,
    emoji: KLASS_THEMES[name][0],
  }))
  return { klasses, kids: buildKids(), rooms: buildRooms() }
}
