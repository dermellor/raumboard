// Curated emoji sets for the picker — no external emoji lib, works offline.
// Drawn from the class themes plus school-room and symbol sets.

// German search terms per emoji (lowercase). Powers the picker search.
export const EMOJI_KEYWORDS: Record<string, string> = {
  '🦊': 'fuchs', '🐻': 'bär braunbär', '🐺': 'wolf', '🐗': 'wildschwein schwein',
  '🦌': 'hirsch reh', '🐿️': 'eichhörnchen', '🦔': 'igel', '🦝': 'waschbär',
  '🐭': 'maus', '🐰': 'hase kaninchen', '🐱': 'katze', '🐶': 'hund', '🐴': 'pferd',
  '🦁': 'löwe', '🐯': 'tiger', '🐘': 'elefant', '🦒': 'giraffe', '🦓': 'zebra',
  '🦛': 'nilpferd flusspferd', '🦏': 'nashorn', '🐪': 'kamel dromedar',
  '🐒': 'affe', '🦍': 'gorilla', '🐊': 'krokodil', '🐍': 'schlange',
  '🦎': 'echse gecko eidechse', '🐢': 'schildkröte', '🐧': 'pinguin',
  '🦩': 'flamingo', '🦜': 'papagei', '🦚': 'pfau', '🐆': 'leopard gepard',
  '🦉': 'eule', '🦅': 'adler', '🕊️': 'taube', '🦢': 'schwan', '🐬': 'delfin',
  '🐳': 'wal', '🦈': 'hai', '🐙': 'krake oktopus tintenfisch', '🦑': 'kalmar tintenfisch',
  '🦐': 'garnele shrimp', '🦞': 'hummer', '🦀': 'krabbe krebs', '🐡': 'kugelfisch',
  '🐠': 'fisch tropenfisch', '🐟': 'fisch', '🐚': 'muschel', '🦭': 'robbe seehund',
  '🐸': 'frosch', '🐝': 'biene', '🦋': 'schmetterling', '🐜': 'ameise',
  '🐞': 'marienkäfer käfer', '🐌': 'schnecke', '🦗': 'grille heuschrecke',
  '🕷️': 'spinne', '🐛': 'raupe wurm', '🪲': 'käfer', '🐄': 'kuh rind',
  '🐖': 'schwein', '🐑': 'schaf', '🐐': 'ziege', '🦙': 'lama alpaka', '🐔': 'huhn hahn henne',
  '🌲': 'tanne nadelbaum baum', '🌳': 'baum laubbaum garten', '🌴': 'palme',
  '🌵': 'kaktus', '🍄': 'pilz fliegenpilz', '🌿': 'kraut pflanze grün',
  '🍃': 'blatt blätter wind', '🎋': 'bambus', '🌱': 'spross setzling pflanze',
  '🪴': 'topfpflanze blumentopf', '🍀': 'klee kleeblatt glück', '🌸': 'kirschblüte blume rosa',
  '🌺': 'hibiskus blume', '🌻': 'sonnenblume blume', '🌼': 'blüte blume gänseblümchen',
  '🌷': 'tulpe blume', '🌹': 'rose blume', '🪻': 'hyazinthe lavendel blume',
  '🌾': 'ähre getreide weizen', '☀️': 'sonne', '🌤️': 'sonne wolke wetter',
  '⛅': 'wolken sonne wetter', '☁️': 'wolke', '🌧️': 'regen wetter',
  '⛈️': 'gewitter blitz sturm', '❄️': 'schneeflocke schnee winter', '🌈': 'regenbogen',
  '🌙': 'mond sichel nacht', '🌟': 'stern leuchtend', '🌠': 'sternschnuppe stern',
  '🪐': 'planet saturn weltall', '🌍': 'erde welt globus planet', '🌕': 'vollmond mond',
  '☄️': 'komet weltall', '🔥': 'feuer flamme', '💧': 'tropfen wasser', '🌊': 'welle meer wasser',
  '🍏': 'apfel grün obst', '🍎': 'apfel rot obst', '🍐': 'birne obst',
  '🍊': 'orange mandarine obst', '🍋': 'zitrone obst', '🍌': 'banane obst',
  '🍉': 'wassermelone melone obst', '🍇': 'trauben weintrauben obst',
  '🍓': 'erdbeere obst', '🫐': 'blaubeeren heidelbeeren obst', '🍈': 'melone obst',
  '🍒': 'kirsche kirschen obst', '🍑': 'pfirsich obst', '🥭': 'mango obst',
  '🍍': 'ananas obst', '🥥': 'kokosnuss obst', '🥝': 'kiwi obst', '🍅': 'tomate gemüse',
  '🍆': 'aubergine gemüse', '🫑': 'paprika gemüse', '🥦': 'brokkoli gemüse',
  '🥬': 'salat kohl gemüse', '🥒': 'gurke gemüse', '🌶️': 'chili scharf',
  '🌽': 'mais gemüse', '🥕': 'karotte möhre gemüse', '🥔': 'kartoffel gemüse',
  '🥨': 'brezel', '🧀': 'käse', '🍪': 'keks cookie', '🧁': 'muffin cupcake kuchen',
  '🍩': 'donut', '🍦': 'eis softeis', '🍭': 'lutscher lolli süßigkeit',
  '⚽': 'fußball ball', '🏀': 'basketball ball', '🏈': 'football ball',
  '⚾': 'baseball ball', '🥎': 'softball ball', '🎾': 'tennis ball',
  '🏐': 'volleyball ball', '🏉': 'rugby ball', '🎱': 'billard kugel',
  '🏓': 'tischtennis ping pong', '🏸': 'badminton federball', '🥅': 'tor netz',
  '🏒': 'eishockey hockey', '⛳': 'golf fahne', '🏹': 'bogen pfeil bogenschießen',
  '🎣': 'angeln angel fisch', '🥊': 'boxen boxhandschuh', '🥋': 'judo karate kampfsport',
  '⛸️': 'schlittschuh eislaufen', '🎿': 'ski wintersport', '🛷': 'schlitten rodeln',
  '🛹': 'skateboard', '🛼': 'rollschuh inliner', '🎳': 'bowling kegeln',
  '🎯': 'dart zielscheibe ziel', '🪁': 'drachen', '🎲': 'würfel spiel',
  '🧩': 'puzzle puzzleteil', '🧸': 'teddy teddybär kuscheltier', '🪀': 'jojo',
  '🎪': 'zirkus zelt', '🎨': 'malen palette kunst farben', '🎭': 'theater masken',
  '🎵': 'musik note', '🎹': 'klavier piano musik', '🥁': 'trommel schlagzeug musik',
  '🎺': 'trompete musik', '🎸': 'gitarre musik',
  '🚗': 'auto wagen', '🚕': 'taxi auto', '🚙': 'auto suv geländewagen',
  '🚌': 'bus schulbus', '🚎': 'bus oberleitungsbus', '🏎️': 'rennauto rennwagen formel',
  '🚓': 'polizei polizeiauto', '🚑': 'krankenwagen rettungswagen', '🚒': 'feuerwehr feuerwehrauto',
  '🚐': 'kleinbus van bulli', '🚚': 'lastwagen lkw lieferwagen', '🚛': 'sattelzug lkw laster',
  '🚜': 'traktor trecker', '🛵': 'roller motorroller vespa', '🏍️': 'motorrad',
  '🚲': 'fahrrad rad', '🛴': 'tretroller scooter roller', '🚅': 'zug schnellzug ice bahn',
  '🚂': 'lokomotive dampflok zug eisenbahn', '🚃': 'waggon zug bahn', '✈️': 'flugzeug fliegen',
  '🚀': 'rakete weltall', '🛸': 'ufo raumschiff', '🚁': 'hubschrauber helikopter',
  '🚢': 'schiff dampfer', '⛴️': 'fähre schiff', '🚤': 'motorboot boot',
  '⛵': 'segelboot boot segeln', '🛶': 'kanu paddelboot boot', '⚓': 'anker',
  '🚠': 'seilbahn gondel', '🎢': 'achterbahn',
  '🏫': 'schule schulgebäude gebäude', '🏠': 'haus zuhause klassenzimmer',
  '🚪': 'tür raum', '🪑': 'stuhl sitz', '🛋️': 'sofa couch', '📚': 'bücher bibliothek stapel',
  '📖': 'buch lesen offen', '📕': 'buch rot', '📗': 'buch grün', '📘': 'buch blau',
  '✏️': 'bleistift stift schreiben', '🖍️': 'wachsmalstift buntstift malen',
  '🖌️': 'pinsel malen', '📐': 'geodreieck winkel mathe', '📏': 'lineal messen',
  '✂️': 'schere schneiden basteln', '🎒': 'schulranzen rucksack ranzen',
  '🔬': 'mikroskop forschen', '🔭': 'teleskop fernrohr sterne', '🧮': 'abakus rechnen mathe',
  '🖥️': 'computer bildschirm pc', '💻': 'laptop computer', '🎧': 'kopfhörer hören',
  '🧪': 'reagenzglas chemie experiment forschen', '🗺️': 'landkarte karte',
  '🧭': 'kompass richtung', '⏰': 'wecker uhr zeit', '🔔': 'glocke klingel pause',
  '🛖': 'hütte haus', '⛺': 'zelt camping', '🏕️': 'camping zelt natur',
  '🔵': 'blau kreis punkt', '🔴': 'rot kreis punkt', '🟢': 'grün kreis punkt',
  '🟡': 'gelb kreis punkt', '🟠': 'orange kreis punkt', '🟣': 'lila violett kreis punkt',
  '🟤': 'braun kreis punkt', '⚫': 'schwarz kreis punkt', '⚪': 'weiß kreis punkt',
  '🔶': 'raute orange', '🔷': 'raute blau', '⭐': 'stern', '💫': 'sterne kreisel',
  '✨': 'funkeln glitzer sterne', '❤️': 'herz rot liebe', '🧡': 'herz orange',
  '💛': 'herz gelb', '💚': 'herz grün', '💙': 'herz blau', '💜': 'herz lila',
  '🤍': 'herz weiß', '🩵': 'herz hellblau', '🩷': 'herz rosa', '🎈': 'luftballon ballon',
  '🎉': 'konfetti party feier', '🏵️': 'rosette blume orden', '🎗️': 'schleife band',
  '🔑': 'schlüssel', '💎': 'diamant edelstein juwel', '🪄': 'zauberstab magie zaubern',
  '👑': 'krone könig königin',
}

/** Search the curated set. Matches German keywords and category names. */
export function searchEmojis(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: string[] = []
  const seen = new Set<string>()
  for (const cat of EMOJI_CATEGORIES) {
    const catMatch = cat.name.toLowerCase().includes(q)
    for (const e of cat.emojis) {
      if (seen.has(e)) continue
      if (catMatch || (EMOJI_KEYWORDS[e] ?? '').includes(q)) {
        seen.add(e)
        hits.push(e)
      }
    }
  }
  return hits
}

export const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Tiere',
    emojis: [
      '🦊', '🐻', '🐺', '🐗', '🦌', '🐿️', '🦔', '🦝', '🐭', '🐰', '🐱', '🐶', '🐴',
      '🦁', '🐯', '🐘', '🦒', '🦓', '🦛', '🦏', '🐪', '🐒', '🦍', '🐊', '🐍', '🦎',
      '🐢', '🐧', '🦩', '🦜', '🦚', '🐆', '🦉', '🦅', '🕊️', '🦢', '🐬', '🐳', '🦈',
      '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐚', '🦭', '🐸', '🐝', '🦋',
      '🐜', '🐞', '🐌', '🦗', '🕷️', '🐛', '🪲', '🐄', '🐖', '🐑', '🐐', '🦙', '🐔',
    ],
  },
  {
    name: 'Natur & Pflanzen',
    emojis: [
      '🌲', '🌳', '🌴', '🌵', '🍄', '🌿', '🍃', '🎋', '🌱', '🪴', '🍀', '🌸', '🌺',
      '🌻', '🌼', '🌷', '🌹', '🪻', '🌾', '☀️', '🌤️', '⛅', '☁️', '🌧️', '⛈️', '❄️',
      '🌈', '🌙', '🌟', '🌠', '🪐', '🌍', '🌕', '☄️', '🔥', '💧', '🌊',
    ],
  },
  {
    name: 'Essen',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🫑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕',
      '🥔', '🥨', '🧀', '🍪', '🧁', '🍩', '🍦', '🍭',
    ],
  },
  {
    name: 'Sport & Spiel',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒',
      '⛳', '🏹', '🎣', '🥊', '🥋', '⛸️', '🎿', '🛷', '🛹', '🛼', '🎳', '🎯', '🪁',
      '🎲', '🧩', '🧸', '🪀', '🎪', '🎨', '🎭', '🎵', '🎹', '🥁', '🎺', '🎸',
    ],
  },
  {
    name: 'Fahrzeuge',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜',
      '🛵', '🏍️', '🚲', '🛴', '🚅', '🚂', '🚃', '✈️', '🚀', '🛸', '🚁', '🚢', '⛴️',
      '🚤', '⛵', '🛶', '⚓', '🚠', '🎢',
    ],
  },
  {
    name: 'Schule & Räume',
    emojis: [
      '🏫', '🏠', '🚪', '🪑', '🛋️', '📚', '📖', '📕', '📗', '📘', '✏️', '🖍️', '🖌️',
      '📐', '📏', '✂️', '🎒', '🔬', '🔭', '🧮', '🖥️', '💻', '🎧', '🧪', '🗺️', '🧭',
      '⏰', '🔔', '🛖', '⛺', '🏕️', '🌳',
    ],
  },
  {
    name: 'Farben & Symbole',
    emojis: [
      '🔵', '🔴', '🟢', '🟡', '🟠', '🟣', '🟤', '⚫', '⚪', '🔶', '🔷', '⭐', '🌟',
      '💫', '✨', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🩵', '🩷', '🎈', '🎉',
      '🏵️', '🎗️', '🔑', '💎', '🪄', '👑',
    ],
  },
]
