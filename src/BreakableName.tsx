import { Fragment } from 'react'
import { slashSegments } from './breakableName'

/**
 * Adds a browser-only line-break opportunity after every slash.
 * <wbr> contributes no text, so visual text, copying and the accessible name
 * stay identical to the stored name. The explicit label makes that contract
 * unambiguous for assistive technology.
 */
export function BreakableName({ name }: { name: string }) {
  const segments = slashSegments(name)

  return (
    <span className="name" aria-label={name}>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment}
          {segment.endsWith('/') && <wbr />}
        </Fragment>
      ))}
    </span>
  )
}
