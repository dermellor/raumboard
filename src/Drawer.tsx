import { useEffect, type ReactNode } from 'react'

/**
 * The one editing surface of the Verwaltung: a drawer over the page, opened by
 * the pencil next to the thing it edits. Tables stay compact overviews (plain
 * text, no inline inputs), popups are gone, and every create/edit form uses
 * this surface so the pages read the same. Escape and a click on the backdrop
 * close it.
 */
export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  /** rendered as the drawer's h2, usually symbol and name */
  title: ReactNode
  onClose: () => void
  children: ReactNode
  /** stays below the content (and below any tabs), e.g. the delete button */
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-label={typeof title === 'string' ? title : 'Bearbeiten'}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
        <h2>{title}</h2>
        {children}
        {footer && <div className="drawer-footer">{footer}</div>}
      </aside>
    </div>
  )
}

/**
 * The tab strip for drawers with more than a handful of fields: short,
 * thematic stays instead of one endless column. Pure presentation, the state
 * lives in the drawer that renders it.
 */
export function DrawerTabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: readonly { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div className="drawer-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={active === t.id ? 'tab on' : 'tab'}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
