import type { CSSProperties } from 'react'
import { EMOJI_SCALE, OPENMOJI_HEX } from './emoji-assets'
import { hexname } from './emoji-hex'
import { useMeta } from './useBoard'

const OPENMOJI = new Set(OPENMOJI_HEX)

// A symbol outside Unicode: the meerkat (Erdmännchen) is a common class
// mascot, but no emoji codepoint exists. It lives on the private-use plane
// U+E0DD and is rendered from its own SVG in BOTH modes — a private-use
// character has no native glyph, so the text fallback would show tofu.
const SVG_ONLY: Record<string, string> = {
  E0DD: 'Erdmännchen', // keyed by hex name; value is the alt text
}

/**
 * A symbol on the boards. With OpenMoji (the default) an emoji is rendered as a
 * self-hosted SVG so every device draws the same picture and old emoji fonts
 * cannot show tofu; anything without an asset (stored data may hold any emoji)
 * falls back to the system emoji. When the school set „Geräte-Emojis" in the
 * Verwaltung, everything renders as text as before, except the custom symbols
 * (SVG_ONLY), which keep their SVG because they have no native counterpart.
 * `force` overrides the school's setting, for previews of both options side by
 * side.
 * `className` carries the sizing the way it always did: the SVG scales with the
 * font-size of its surroundings. `--sym-scale` carries the painted-area factor
 * from the manifest (see scripts/fetch-openmoji.mjs), so thin or flat designs
 * (a car, a stack of books) reach the same optical presence as dense ones
 * (a fox, a sun). The stylesheet applies it: a transform grows the artwork
 * beyond its 1em box, margins grow the layout box by the same amount, so
 * neighbors keep their distance. Contexts with fixed-size boxes drop the
 * margins there (the factor is capped to fit).
 */
export function Symbol({
  value,
  className,
  force,
}: {
  value: string
  className?: string
  force?: 'openmoji' | 'native'
}) {
  const meta = useMeta()
  const mode = force ?? meta.symbols ?? 'openmoji'
  const hex = hexname(value)
  const custom = SVG_ONLY[hex]
  if ((mode !== 'native' || custom !== undefined) && hex && OPENMOJI.has(hex))
    return (
      <span className={['sym', className].filter(Boolean).join(' ')}>
        <img
          src={`/emoji/${hex}.svg`}
          alt={custom ?? value}
          draggable={false}
          style={EMOJI_SCALE[hex] !== undefined ? { '--sym-scale': EMOJI_SCALE[hex] } as CSSProperties : undefined}
        />
      </span>
    )
  return <span className={className}>{value}</span>
}
