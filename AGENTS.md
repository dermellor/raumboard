# Raumboard

**Product name: Raumboard · domain: raumboard.de** (repo/dir still `lernraum-board`
for local-infra stability; rename is cosmetic and can happen with the Phase-2 repo
publication).

Room-booking board for primary schools with open learning concepts ("Pädagogische
Architektur"): kids book themselves out of their classroom into learning spaces
(Lernateliers, library, hallway desks, garden, foyer) during self-directed learning
time. Boards run on digital classroom whiteboards, PCs, and iPads via plain URLs.
First rollout is a pilot primary school in NRW.

## Vision & tracks

- **No paid SaaS.** Open source; any tech-savvy school (or parent) can self-host.
- **Track A — Open source:** public repo, Docker image, self-hosting docs marked
  "experimental, no support" while the product iterates fast.
- **Track B — Hosted by the maintainer, free:** classic login, multiple schools on
  one deployment so updates land everywhere at once. Early schools go here.
- Positioning: the *daily-operations layer* of Pädagogische Architektur — the
  planning/building world (QUA-LiS, Montag Stiftung) has no tool for "who learns
  where right now". Content vocabulary: Lernorte, Lernlandschaft, Cluster,
  Lernatelier, Selbstlernzeit, "Dem Lernen Raum geben", dritter Pädagoge.

## Target architecture (Phase 2+)

- **One codebase, tenant = subdomain, one SQLite file per school**
  (`<slug>.raumboard.de` → `data/<slug>.db`). Self-hosting = same app with a single
  default tenant. No tenant columns anywhere.
- **Server:** a Linux VPS with a reverse proxy (wildcard or on-demand TLS for
  `*.raumboard.de`), Node/Hono, WebSockets for realtime, and per-school DB backups
  to object storage.
- **Auth:** per school one admin login (email + password, Argon2, cookie session)
  for Verwaltung + one teacher PIN that unlocks class boards per device. Kids
  never log in. Onboarding/reset is manual by the operator in the early phase.
- **Data minimization:** first name + initial only, never full names.
- **AVV/DSGVO:** hosting for schools makes the hosting operator an
  Auftragsverarbeiter even when free — AVV template + TOM doc required before the
  first real kid data. Templates live in `docs/`.

## Status / roadmap

- **Phase 1 (done):** clickable prototype, localStorage store, cross-tab sync via
  `storage` event, kid-friendly design, emoji picker with German search, admin
  tables with modals. Ships as a static demo build (localStorage mode).
- **Phase 2 (next, target: NRW school-year start, ~mid-August 2026):** backend
  (Hono + SQLite + WS, local port 3211), tenant-by-subdomain, admin login +
  teacher PIN, production deploy, raumboard.de DNS, first pilot tenant.
- **Phase 3:** Excel/CSV import+export of class lists (school-year start flow),
  backup automation, AVV template + DSGVO docs.
- **Phase 4:** public repo, Docker/Compose self-hosting path, demo mode as
  showcase (current localStorage store stays as the demo/offline mode).

## Privacy rule (hard)

Never commit real children's names. Seeds and fixtures use generated dummy names
only (emoji symbol + first name + last-name initial, mirroring the original
sheet's structure). The school enters real data in production only.

## Architecture (current, Phase 1)

- Vite + React 19 + TypeScript; runtime deps: react, react-dom, lucide-react
  (UI icons — content emojis stay emojis). No router package (tiny hash router),
  no state package (own store).
- `src/types.ts` — domain model: `Klass`, `Kid`, `Room`. `Kid.currentRoomId = null`
  means "in own classroom". Room `scope` is `'all'` or a `klassId` (class-bound
  hallway desks). Occupancy is always derived, never stored.
- `src/store.ts` — booking rules + admin mutations behind a store interface
  (`getState`, `book`, `unbook`, `reset`, `subscribe`, admin CRUD). This interface
  is the contract for the Phase-2 API; only the implementation gets swapped.
- `src/seed.ts` — 8 classes (1A–4B) with themed emoji sets, ~27 dummy kids each,
  14 rooms.
- `src/views/` — `Home` (`#/`), `KlassenBoard` (`#/klasse/:id`), `RaumSicht`
  (`#/raum/:id`), `Admin` (`#/admin`).
- `src/RoomPicker.tsx` — shared "Wohin gehst du?" overlay (class board + room view).
- `src/EmojiButton.tsx` + `src/emojis.ts` — offline emoji picker with German
  keyword search.

## Booking rules

A kid can book into a room iff the room `isOpen`, has free capacity, and its
`scope` is `'all'` or equals the kid's class. Booking out sets
`currentRoomId = null`. Global reset ("Feierabend-Reset") sets every kid to `null`.

## Ports

| Port  | Service                          |
| ----- | -------------------------------- |
| 3210  | Vite dev server (`strictPort`)   |
| 3211  | reserved: local API (Phase 2)    |

**Local dev runs the real API stack, not demo mode.** `npm run dev` (and the PM2
`dev:pm2`) start API server + Vite concurrently in API mode with HMR. With
`RAUMBOARD_DEV=1` (set by `dev:api`, guarded by `!PROD`) the server auto-provisions
the `dev` tenant with seed data and fixed local credentials:
**login `dev@raumboard.local` / `raumboard`, teacher PIN `0000`**. Local HTTPS URL:
`https://raumboard.localhost` (Caddy → Vite 3210 → proxies `/api` + WS to API 3211).
`npm run dev:demo` runs the old frontend-only localStorage mode if ever needed.

## Deploy

The app self-hosts as a Node/Hono server (SQLite per tenant, WebSockets) behind a
reverse proxy that terminates TLS. Env config lives in a server-side `.env` (session
secret, base domain, backup credentials — never in the repo). Per-school DBs back up
nightly to object storage. A Docker/Compose self-hosting path is the Phase-4 goal.

**Static demo:** `npm run build` produces a `dist/` that runs in demo mode
(frontend-only localStorage store), suitable for any static host.
