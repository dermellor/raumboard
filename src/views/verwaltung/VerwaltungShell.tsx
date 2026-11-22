import {
  KeyRound, LayoutGrid, Lock, Presentation, School, Settings, Sprout, Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { reseed } from '../../store'
import type { VerwaltungPage } from '../../router'
import { PasswordGate } from '../../PasswordGate'
import { PinGate } from '../../PinGate'
import { useMeta } from '../../useBoard'
import { clearTeacherAccess, confirmTeacherPin } from '../../store'
import { KinderPage } from './KinderPage'
import { RaeumePage } from './RaeumePage'
import { TafelnPage } from './TafelnPage'
import { ZugaengePage } from './ZugaengePage'
import { needsTeacherPin } from '../../verwaltungAccess'

/**
 * The two halves of the navigation: the left one needs the teacher PIN, the
 * right one asks for the school's password in front of each page. The halves
 * differ in nothing but the access level, so they are told apart by the
 * separator and the lock icons and carry no names of their own.
 */
const PAGES = [
  { page: 'raeume', label: 'Räume', icon: <LayoutGrid />, group: 'pin' },
  { page: 'kinder', label: 'Klassen & Kinder', icon: <Users />, group: 'pin' },
  { page: 'tafeln', label: 'Tafeln', icon: <Presentation />, group: 'pin' },
  { page: 'zugaenge', label: 'Zugänge', icon: <KeyRound />, group: 'password' },
] as const

/** Pages that only make sense against the server (api mode), never in the demo. */
const API_ONLY_PAGES: readonly VerwaltungPage[] = ['tafeln', 'zugaenge']

/** The pages that ask for the school's password before they open. */
const PASSWORD_PAGES: readonly VerwaltungPage[] = ['zugaenge']

/**
 * The Verwaltung: one route per page (`#/verwaltung/<page>`, deep-linkable),
 * the teacher PIN on every entry, and the school's password on every entry to
 * a password page. Both gates are component state, so they hold as long as
 * this shell stays mounted: switching pages keeps the PIN, and a confirmed
 * password holds for its own page until another one is opened.
 */
export function Verwaltung({ page }: { page: VerwaltungPage }) {
  const meta = useMeta()
  // the school's password once the gate confirmed it *for this page*, so the
  // credential forms can send it without asking a second time; leaving the
  // page drops the confirmation, and returning asks for it again
  const [confirmed, setConfirmed] = useState<{ page: VerwaltungPage; password: string } | null>(null)

  // The Verwaltung proof belongs to this mounted namespace only. A route
  // change inside it keeps the component; leaving or reloading loses it.
  useEffect(() => () => clearTeacherAccess(), [])

  const confirmedHere = confirmed?.page === page ? confirmed.password : null
  // A dev-open session may unlock the board itself, but the Verwaltung still
  // asks for the teacher PIN on every entry. This is both the production rule
  // and important for previews opened through an operator link: that link must
  // not make the PIN gate disappear.
  const devOpen = meta.devOpen === true
  const needsPassword =
    meta.mode === 'api' && PASSWORD_PAGES.includes(page) && confirmedHere === null && !devOpen
  const locked = (p: VerwaltungPage) =>
    meta.mode === 'api' && PASSWORD_PAGES.includes(p) && confirmed?.page !== p && !devOpen

  // The teacher PIN is the key to the whole Verwaltung, and it is asked on
  // *every* entry: the device unlock lasts months, a class does not. Component
  // state, not a cookie — leaving the namespace locks it again. The password
  // pages ask for the school's password on top of it, the same way.
  const gateOpen = needsTeacherPin(meta)

  // The Tafeln page is all write affordances (what it configures is only
  // readable on the board itself), so it is an account page: teachers see no
  // tab, and a deep link lands on the rooms.
  const tafelnHidden = page === 'tafeln' && meta.mode === 'api' && !meta.isAdmin
  useEffect(() => {
    if (tafelnHidden) window.location.hash = '#/verwaltung/raeume'
  }, [tafelnHidden])

  return (
    <main className="admin">
      <div className="topbar">
        <a href="#/">
          <School className="icon-accent" /> Start
        </a>
        <h1>
          <Settings className="icon-h1" /> Verwaltung
        </h1>
      </div>

      {gateOpen ? (
        <PinGate
          intro="Die Verwaltung ist nur für Lehrkräfte. Bitte die PIN eingeben."
          demoPin="hint"
          authenticate={confirmTeacherPin}
          onSuccess={() => {}}
          onClose={() => {
            window.location.hash = '#/'
          }}
        />
      ) : (
        <>
          <nav className="tabbar">
            {PAGES.filter(
              (p) =>
                (!API_ONLY_PAGES.includes(p.page) || meta.mode === 'api') &&
                (p.page !== 'tafeln' || meta.isAdmin),
            ).map(
              (p, i, all) => (
                <span key={p.page} className="tabbar-slot">
                  {/* the rule between the halves is the only visible
                      expression of the two access levels */}
                  {i > 0 && all[i - 1].group !== p.group && (
                    <span className="tabbar-sep" aria-hidden="true" />
                  )}
                  <a
                    className={page === p.page ? 'active' : undefined}
                    href={`#/verwaltung/${p.page}`}
                  >
                    {p.icon} {p.label}
                    {locked(p.page) && <Lock className="icon-soft" />}
                  </a>
                </span>
              ),
            )}
          </nav>

          {needsPassword ? (
            <PasswordGate
              onSuccess={(password) => setConfirmed({ page, password })}
              onClose={() => {
                window.location.hash = '#/verwaltung/raeume'
              }}
            />
          ) : (
            <>
              {page === 'raeume' && <RaeumePage />}
              {page === 'kinder' && <KinderPage />}
              {page === 'tafeln' && meta.mode === 'api' && <TafelnPage />}
              {page === 'zugaenge' && meta.mode === 'api' && (
                <ZugaengePage password={confirmedHere ?? ''} />
              )}
            </>
          )}

          {/* resetting the data is not about any one page, so it sits at the
              foot of the shell, below whatever page is open */}
          {(meta.mode === 'demo' || meta.dev) && (
            <footer className="admin-foot">
              {meta.mode === 'demo' && (
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm('Alles verwerfen und die Beispieldaten neu laden?')) reseed()
                  }}
                >
                  <Sprout /> Beispieldaten neu laden
                </button>
              )}
              {meta.dev && (
                <button
                  className="danger"
                  title="Nur lokal: aktuelle Daten verwerfen und den Beispiel-Datensatz laden"
                  onClick={() => {
                    if (confirm('Bestehende Daten wirklich durch Beispieldaten ersetzen?')) reseed()
                  }}
                >
                  <Sprout /> Bestehende Daten durch Beispieldaten ersetzen (Dev)
                </button>
              )}
            </footer>
          )}
        </>
      )}
    </main>
  )
}
