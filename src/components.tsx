import type { ReactNode } from 'react'

/** Capacity as dots: filled/bright = free, faded = taken. Readable without reading. */
export function Seats({ capacity, occupied }: { capacity: number; occupied: number }) {
  if (capacity <= 0 || capacity > 30) return null
  return (
    <span className="seats" aria-label={`${capacity - occupied} von ${capacity} frei`}>
      {Array.from({ length: capacity }, (_, i) => (
        <i key={i} className={i >= occupied ? 'free' : undefined} />
      ))}
    </span>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="picker modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="topbar">
      <a href="#/">🏫 Start</a>
      <h1>{title}</h1>
      {children}
    </div>
  )
}
