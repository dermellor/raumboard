// OpenMoji file names drop the text-presentation selector (FE0F) and keep
// everything else, including the ZWJ (200D) that joins sequences like 🐈‍⬛.
// Shared by Symbol.tsx (asset lookup) and roomColor.ts (color lookup); the
// fetch script keeps a twin in plain JavaScript because it cannot import TS.
// Keep in sync with scripts/fetch-openmoji.mjs.
export const hexname = (emoji: string): string =>
  [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16).toUpperCase())
    .filter((h) => h !== 'FE0F')
    .join('-')
