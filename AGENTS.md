# Raumboard

**Product name: Raumboard · domain: raumboard.de** (repo/dir still `lernraum-board`
for local-infra stability; rename is cosmetic and can happen with the Phase-2 repo
publication).

Room-booking board for primary schools with open learning concepts ("Pädagogische
Architektur"): kids book themselves out of their classroom into learning spaces
(Lernateliers, library, hallway desks, garden, foyer) during self-directed learning
time. Boards run on digital classroom whiteboards, PCs, and iPads via plain URLs.
First school: Beispielschule, NRW (principal N.N., also part of the
QUA-LiS NRW "Pädagogische Architektur" advisor team — distribution channel).

## Vision & tracks (decided 2026-07)

- **No paid SaaS.** Open source; any tech-savvy school (or parent) can self-host.
- **Track A — Open source:** public repo, Docker image, self-hosting docs marked
  "experimental, no support" while the product iterates fast.
- **Track B — Hosted by Marcel, free:** classic login, multiple schools on one
  deployment so updates land everywhere at once. Early schools go here.
- Positioning: the *daily-operations layer* of Pädagogische Architektur — the
  planning/building world (QUA-LiS, Montag Stiftung) has no tool for "who learns
  where right now". Content vocabulary: Lernorte, Lernlandschaft, Cluster,
  Lernatelier, Selbstlernzeit, "Dem Lernen Raum geben", dritter Pädagoge.

## Target architecture (Phase 2+)

- **One codebase, tenant = subdomain, one SQLite file per school**
  (`beispielschule.raumboard.de` → `data/beispielschule.db`). Self-hosting = same app
  with a single default tenant. No tenant columns anywhere.
- **Server:** Hetzner VPS (Falkenstein), Caddy (wildcard cert `*.raumboard.de`),
  Node/Hono, WebSockets for realtime, Litestream backup per school DB to Bunny
  Storage. Bunny CDN stays for static assets/prototype.
- **Auth:** per school one admin login (email + password, Argon2, cookie session)
  for Verwaltung + one teacher PIN that unlocks class boards per device. Kids
  never log in. Onboarding/reset manual by Marcel in the early phase.
- **Data minimization:** first name + initial only, never full names.
- **AVV/DSGVO:** hosting for schools makes Marcel an Auftragsverarbeiter even for
  free — AVV template + TOM doc required before first real kid data.

## Status / roadmap

- **Phase 1 (done):** clickable prototype, localStorage store, cross-tab sync via
  `storage` event, kid-friendly design, emoji picker with German search, admin
  tables with modals. Deployed to https://lernraum-board.b-cdn.net (Bunny Storage
  + Pull Zone, deploy via `scripts/deploy-bunny.py`).
- **Phase 2 (next, target: NRW school-year start, ~mid-August 2026):** backend
  (Hono + SQLite + WS, local port 3211), tenant-by-subdomain, admin login +
  teacher PIN (N.N. wishlist), Hetzner deploy, raumboard.de DNS, Beispielschule
  as first tenant.
- **Phase 3:** Excel/CSV import+export of class lists (school-year start flow),
  backup automation, AVV template + DSGVO docs.
- **Phase 4:** public repo, Docker/Compose self-hosting path, demo mode as
  showcase (current localStorage store stays as the demo/offline mode).

## Feedback backlog (N.N. mail 2026-07-21)

- Password protection for Verwaltung → Phase 2 auth
- Protect class boards from kid mischief → teacher PIN
- Easy room adding → done (admin modal)
- Import kids/whole classes at school-year start (Excel) → Phase 3

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

Port block **3210–3219** — see `~/Development/PORTS.md`.

| Port  | Service                          |
| ----- | -------------------------------- |
| 3210  | Vite dev server (`strictPort`)   |
| 3211  | reserved: local API (Phase 2)    |
| 32100–32109 | worktree preview pool (`npm run dev:worktree`, `WT_PORT`) |

**Local dev runs the real API stack, not demo mode.** `npm run dev` (and the PM2
`dev:pm2`) start API server + Vite concurrently in API mode with HMR. With
`RAUMBOARD_DEV=1` (set by `dev:api`, guarded by `!PROD`) the server auto-provisions
the `dev` tenant with seed data and fixed local credentials:
**login `dev@raumboard.local` / `raumboard`, teacher PIN `0000`**. Local HTTPS URL:
`https://raumboard.localhost` (Caddy → Vite 3210 → proxies `/api` + WS to API 3211).
`npm run dev:demo` runs the old frontend-only localStorage mode if ever needed.

## Deploy

**Hosted (production):** `bash deploy/deploy.sh` — builds the frontend, rsyncs
`dist/ server/ src/ package*.json` to `deploy-host:/opt/raumboard/app`, runs
`npm ci --omit=dev`, restarts the `raumboard` systemd service. Server layout:
`/opt/raumboard/{app,data,backups}`, env in `/opt/raumboard/.env` (secret,
domain, Bunny backup password — never in the repo or chat). Caddy terminates
TLS: on-demand certs per school subdomain via `GET /ask` (see
`/etc/caddy/Caddyfile`, backup at `Caddyfile.bak-raumboard`). Nightly backups:
`raumboard-backup.timer` → Bunny Storage zone `raumboard-backups` (14 days).
Tenant admin on the server:
`cd /opt/raumboard/app && ./node_modules/.bin/tsx server/cli.ts create-school|reset-credentials|list`
(credentials land in `/opt/raumboard/credentials-<slug>.txt`).

**Demo prototype (static):** `npm run build && python3 scripts/deploy-bunny.py`
— uploads `dist/` to Bunny Storage zone `lernraum-board`
(https://lernraum-board.b-cdn.net), runs in demo mode (localStorage).
