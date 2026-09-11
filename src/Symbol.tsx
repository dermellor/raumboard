import { OPENMOJI_HEX } from './emoji-assets'
import { useMeta } from './useBoard'

const OPENMOJI = new Set(OPENMOJI_HEX)

// OpenMoji file names drop the text-presentation selector (FE0F) and keep
// everything else, including the ZWJ (200D) that joins sequences like 🐈‍⬛.
// Keep in sync with scripts/fetch-openmoji.mjs.
const hexname = (emoji: string): string =>
  [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16).toUpperCase())
    .filter((h) => h !== 'FE0F')
    .join('-')

/**
 * A symbol on the boards. With OpenMoji (the default) an emoji is rendered as a
 * self-hosted SVG so every device draws the same picture and old emoji fonts
 * cannot show tofu; anything without an asset (stored data may hold any emoji)
 * falls back to the system emoji. When the school set „Geräte-Emojis" in the
 * Verwaltung, everything renders as text as before. `force` overrides the
 * school's setting, for previews of both options side by side.
 * `className` carries the sizing the way it always did: the SVG scales with the
 * font-size of its surroundings.
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
  if (mode !== 'native' && hex && OPENMOJI.has(hex))
    return (
      <span className={['sym', className].filter(Boolean).join(' ')}>
        <img src={`/emoji/${hex}.svg`} alt={value} draggable={false} />
      </span>
    )
  return <span className={className}>{value}</span>
}
