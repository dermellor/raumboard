#!/usr/bin/env node
// Fetches the OpenMoji SVG for every emoji in src/emojis.ts into public/emoji
// and regenerates src/emoji-assets.ts, the manifest Symbol.tsx renders from.
// Idempotent: files already on disk are kept, so a second run works offline.
// OpenMoji (https://openmoji.org) is CC BY-SA 4.0; the license text is fetched
// once into public/emoji/LICENSE-OpenMoji.txt so the attribution ships with it.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const RAW = 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg'
const LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt'
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIR = join(ROOT, 'public/emoji')
const MANIFEST = join(ROOT, 'src/emoji-assets.ts')
const LICENSE_FILE = join(DIR, 'LICENSE-OpenMoji.txt')

// --- color derivation --------------------------------------------------------
// Every OpenMoji SVG carries its palette as flat fill colors. The most common
// non-neutral fill is the emoji's "identity" color; accent (readable on light
// tints, clamped for saturation and lightness) and tint (~93% lightness for
// tile backgrounds) are derived from it, so no hand-curated color map exists
// and the OpenMoji artwork stays the single source. White/black/gray fills are
// skipped by saturation; an SVG without any colored fill yields no entry and
// the runtime falls back to a neutral pair (see src/roomColor.ts).

const hexToRgb = (hex) => {
  const h = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}

const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b]
    .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'))
    .join('')

const rgbToHsl = ([r, g, b]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

const hslToRgb = ([h, s, l]) => {
  if (s === 0) return [l, l, l]
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** accent: same hue, saturation and lightness clamped so text stays readable. */
const deriveAccent = (rgb) => {
  const [h, s] = rgbToHsl(rgb)
  return rgbToHex(hslToRgb([h, clamp(s, 0.45, 0.9), clamp(rgbToHsl(rgb)[2], 0.34, 0.52)]))
}

/** tint: same hue, washed out to ~93% lightness for tile backgrounds. */
const deriveTint = (rgb) => {
  const [h, s] = rgbToHsl(rgb)
  return rgbToHex(hslToRgb([h, clamp(s, 0.3, 0.75), 0.93]))
}

/** Most common non-neutral fill of an SVG, or null if there is none. */
const dominantFill = (svg) => {
  const counts = new Map() // preserves first-seen order for stable tie-breaking
  for (const m of svg.matchAll(/fill="#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})"/g)) {
    const hex = m[1].toLowerCase()
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  let best = null
  for (const [hex, count] of counts) {
    const rgb = hexToRgb(hex)
    const [, s, l] = rgbToHsl(rgb)
    if (s < 0.25 || l > 0.95) continue // white, black, grays: no identity color
    if (best === null || count > counts.get(best)) best = hex
  }
  return best
}

const colorPair = (svg) => {
  const hex = dominantFill(svg)
  if (hex === null) return null
  const rgb = hexToRgb(hex)
  return { accent: deriveAccent(rgb), tint: deriveTint(rgb) }
}
// --- /color derivation ------------------------------------------------------

// OpenMoji file names drop the text-presentation selector (FE0F) and keep
// everything else, including the ZWJ (200D) that joins sequences like 🐈‍⬛.
const hexname = (emoji) =>
  [...emoji]
    .map((c) => c.codePointAt(0).toString(16).toUpperCase())
    .filter((h) => h !== 'FE0F')
    .join('-')

// The picker list is the main source, but not the only one: seed data uses
// emoji beyond it (a seed kid may carry 🦧 while the picker lists 🦍), and any
// literal in src/ (🚪 fallbacks, headings) must render in the house style too.
// So every emoji run in every source file is collected, not just the exports
// of emojis.ts. Stored data can still hold anything; unknown emoji render as
// system text (see Symbol.tsx).
// The FE0F selector sits in the class on purpose: a run like ☀️ is one match.
// oxlint-disable-next-line no-misleading-character-class
const EMOJI_RUN = /[\p{Extended_Pictographic}\u200D\uFE0F]+/gu

async function collectEmojis(dir) {
  const found = new Set()
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const e of await collectEmojis(join(dir, entry.name))) found.add(e)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      const text = await readFile(join(dir, entry.name), 'utf-8')
      for (const m of text.matchAll(EMOJI_RUN)) found.add(m[0])
    }
  }
  return found
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.text()
}

async function run() {
  await mkdir(DIR, { recursive: true })

  if (!existsSync(LICENSE_FILE)) {
    process.stdout.write('license … ')
    await writeFile(LICENSE_FILE, await fetchText(LICENSE), 'utf-8')
    console.log('ok')
  }

  const missing = []
  let done = 0
  const emojis = [...(await collectEmojis(join(ROOT, 'src')))]
  const queue = [...new Set(emojis.map(hexname))]
  while (queue.length > 0) {
    const batch = queue.splice(0, 8)
    await Promise.all(
      batch.map(async (hex) => {
        const file = `${DIR}/${hex}.svg`
        if (existsSync(file)) return
        try {
          const svg = await fetchText(`${RAW}/${hex}.svg`)
          await writeFile(file, svg, 'utf-8')
        } catch (e) {
          missing.push(`${hex} (${e.message})`)
        } finally {
          done += 1
          process.stdout.write(`\r${done}/${emojis.length}`)
        }
      })
    )
  }
  console.log('')

  if (missing.length > 0) {
    console.log(`no OpenMoji asset for ${missing.length} (they keep rendering as text):`)
    for (const m of missing) console.log(`  ${m}`)
  }

  // The manifest lists what is actually on disk, not what was requested, so a
  // skipped download can never leave Symbol.tsx pointing at a missing file.
  const onDisk = (await readFile(MANIFEST, 'utf-8').catch(() => ''))
    .match(/'([0-9A-F-]+)'/g)
    ?.map((s) => s.slice(1, -1)) ?? []
  const hexes = [
    ...new Set([
      ...onDisk,
      ...emojis.map(hexname).filter((h) => !missing.some((m) => m.startsWith(`${h} `))),
    ]),
  ].sort()

  // One accent/tint pair per SVG on disk (see "color derivation" above);
  // SVGs without a colored fill simply have no entry.
  const colors = {}
  for (const hex of hexes) {
    const file = `${DIR}/${hex}.svg`
    if (!existsSync(file)) continue
    const pair = colorPair(await readFile(file, 'utf-8'))
    if (pair) colors[hex] = pair
  }

  await writeFile(
    MANIFEST,
    `// Generated by scripts/fetch-openmoji.mjs — do not edit by hand.
// Hex names of the OpenMoji SVGs in public/emoji (CC BY-SA 4.0, openmoji.org),
// plus the accent/tint color pair derived from each SVG's dominant fill
// (consumed by src/roomColor.ts for the room tiles).
export const OPENMOJI_HEX: string[] = [
${hexes.map((h) => `  '${h}',`).join('\n')}
]

export type EmojiColor = { accent: string; tint: string }

export const EMOJI_COLORS: Record<string, EmojiColor> = {
${Object.keys(colors)
  .sort()
  .map((h) => `  '${h}': { accent: '${colors[h].accent}', tint: '${colors[h].tint}' },`)
  .join('\n')}
}
`,
    'utf-8'
  )
  console.log(`manifest: ${hexes.length} emoji, ${Object.keys(colors).length} with colors (src/emoji-assets.ts)`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
