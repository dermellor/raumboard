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
  'Malte', 'Marlene', 'Malia', 'Marian', 'Melina', 'Mert', 'Mika', 'Moritz', 'Mia', 'Mateo',
  'Marla', 'Milan', 'Marit', 'Malou', 'Jannik', 'Jolina', 'Jacob', 'Jette', 'Jamal', 'Jeremias',
  'Joel', 'Johanna', 'Jaro', 'Janne', 'Justus', 'Justin', 'Jamil', 'Jörn', 'Jana', 'Jella',
  'Kaan', 'Kai', 'Kalle', 'Kasimir', 'Kian', 'Kolja', 'Konrad', 'Keno', 'Kerem', 'Kevin',
  'Karla', 'Kim', 'Kira', 'Klara', 'Katja', 'Kilian', 'Koray', 'Lene', 'Lea', 'Lars',
  'Lia', 'Louis', 'Ludwig', 'Leander', 'Levi', 'Lennard', 'Leni', 'Lilly', 'Luisa', 'Luka',
  'Lucie', 'Lias', 'Nils', 'Nela', 'Niels', 'Nike', 'Noel', 'Nika', 'Nino', 'Niklas',
  'Nadia', 'Neele', 'Ole', 'Olga', 'Onur', 'Ove', 'Ozan', 'Pia', 'Pit', 'Peer',
  'Pelle', 'Pinar', 'Poyraz', 'Philine', 'Rana', 'Ravi', 'Remi', 'Rieke', 'Ronja', 'Ruben',
  'Romy', 'Rida', 'Rania', 'Sem', 'Sinan', 'Semih', 'Selma', 'Svea', 'Silas', 'Sonja',
  'Said', 'Sven', 'Sanne', 'Tale', 'Talha', 'Teo', 'Tom', 'Tjark', 'Timur', 'Titus',
  'Tamin', 'Tara', 'Thies', 'Ulla', 'Umut', 'Vito', 'Viana', 'Vincent', 'Viggo', 'Wilma',
  'Wanja', 'Yusuf', 'Yasin', 'Yasmin', 'Ylvi', 'Zoe', 'Zeki', 'Zeynep', 'Finn', 'Finja',
  'Fiete', 'Fina', 'Fabian', 'Amira', 'Anouk', 'Arne', 'Ali', 'Asya', 'Arda', 'Alina',
  'Ayaz', 'Annika', 'Arvid', 'Hakan', 'Hilda', 'Hanne', 'Hauke', 'Ismail', 'Ina', 'Ivar',
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
      // One running index over the whole school, wrapping at the pool's end: 216
      // kids on 210 names means the last six kids of 4B share 1A's first six
      // first names, the way a real school also has a few of those — the boards
      // show exactly those with their last-name initial (see src/displayName.ts).
      const first = FIRST_NAMES[kids.length % FIRST_NAMES.length]
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
  // the third grade shares one cluster, so its two classes also share the
  // hallway desks — the case the scope list exists for
  const flure: Room[] = KLASS_NAMES.filter((n) => n !== '3A' && n !== '3B')
    .map((name) => ({
      id: `flur-${klassId(name)}`,
      name: `Flur ${name}`,
      emoji: '🧩',
      capacity: 3,
      isOpen: true,
      scope: [klassId(name)],
    }))
  const flur3: Room = {
    id: 'flur-3',
    name: 'Flur 3 (A+B)',
    emoji: '🧩',
    capacity: 6,
    isOpen: true,
    scope: [klassId('3A'), klassId('3B')],
  }
  return [...shared, ...flure, flur3]
}

export function buildSeed(): BoardState {
  const klasses: Klass[] = KLASS_NAMES.map((name) => ({
    id: klassId(name),
    name,
    emoji: KLASS_THEMES[name][0],
  }))
  return { klasses, kids: buildKids(), rooms: buildRooms() }
}
