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

Ports come from the instance profile (`RAUMBOARD_WEB_PORT`, `RAUMBOARD_PORT`), so
the numbers below are one host's assignment rather than a property of the project.
Both the Vite config and `scripts/dev-prep.sh` read them, which is what stops one
instance from killing the other's server.

| Port  | Service                                   |
| ----- | ----------------------------------------- |
| 3210  | Vite dev server, instance `selfhosted`    |
| 3211  | API server, instance `selfhosted`         |
| 3213  | Vite dev server, instance `hosted`        |
| 3214  | API server, instance `hosted`             |

**Local dev runs the real API stack, not demo mode.** `npm run dev` (and the PM2
`dev:pm2`) start API server + Vite concurrently in API mode with HMR. With
`RAUMBOARD_DEV=1` (set by `scripts/dev-api.sh`, guarded by `!PROD`) the server
auto-provisions the **default tenant** with seed data and fixed local credentials:
**login `dev@raumboard.local` / `raumboard`, teacher PIN `0000`**. Which tenant
that is comes from `RAUMBOARD_DEFAULT_TENANT`; with no profile it is `dev`. In
platform mode the variable is empty, so nothing is auto-provisioned and schools
are created with the CLI instead.

Local HTTPS goes through a reverse proxy that terminates TLS and forwards to the
Vite port, which proxies `/api` and the WebSocket on to the API port.
`npm run dev:demo` runs the old frontend-only localStorage mode if ever needed.

## Instances

A tenant is a school inside one deployment. An **instance** is a whole
deployment: a local test board, a staging server, production. One checkout
addresses several of them, so which one is being worked on has to be a single
variable rather than an edit pass over config files.

Instance values live **outside the repo**, one file per instance:

```
~/.config/raumboard/instances/<name>.env
```

Selected by naming it, with anything already in the environment winning:

```bash
RAUMBOARD_INSTANCE=test npm run dev
RAUMBOARD_INSTANCE=prod bash deploy/deploy.sh
```

`RAUMBOARD_INSTANCE_DIR` moves the profile directory. A name is a single path
segment of `[A-Za-z0-9._-]`; anything else is refused rather than resolved. A
named profile that does not exist is a hard error, so a typo cannot silently
deploy to the wrong host. Unset `RAUMBOARD_INSTANCE` is the plain
single-deployment case and reads nothing outside the repo — that is what a fresh
clone and the systemd unit both do, the unit taking its environment from
`EnvironmentFile` instead.

The loader is [`scripts/instance.sh`](scripts/instance.sh), sourced by
[`scripts/dev-api.sh`](scripts/dev-api.sh), [`scripts/dev-web.sh`](scripts/dev-web.sh),
[`scripts/dev-prep.sh`](scripts/dev-prep.sh), [`scripts/cli.sh`](scripts/cli.sh)
and [`deploy/deploy.sh`](deploy/deploy.sh). Profiles hold plain `KEY=value` lines
and are read verbatim, so paths in them are absolute (`~` is not expanded). Every
variable is listed in [`.env.example`](.env.example).

### The two operating modes are two instances

The product ships in two shapes, and both are worth having running locally,
because they differ in exactly the thing that is easy to break:

| Mode           | `RAUMBOARD_DEFAULT_TENANT` | Tenant comes from            |
| -------------- | -------------------------- | ---------------------------- |
| **self-hosted** | set to the one school's slug | nothing, every Host is that school |
| **platform**    | empty                       | the Host header, `<slug>.<RAUMBOARD_DOMAIN>` |

An empty `RAUMBOARD_DEFAULT_TENANT` is what selects platform mode, and it also
turns off the dev auto-seed, since a platform has no single school to seed.
`scripts/dev-api.sh` therefore defaults it with `${VAR-dev}` rather than
`${VAR:-dev}`: a profile that sets it to the empty string means it.

Both modes run side by side from one checkout, so each instance carries its own
ports (`RAUMBOARD_WEB_PORT`, `RAUMBOARD_PORT`) and its own `RAUMBOARD_DATA`. The
Vite config reads both port variables, which is also what keeps `/api` proxying
to the right server. `changeOrigin` stays off on that proxy: the API resolves the
tenant from the Host header, so it has to survive the hop.

Schools in platform mode are created with the CLI, against the named instance:

```bash
RAUMBOARD_INSTANCE=hosted npm run cli -- create-school demo "Demoschule" admin@example.org --seed
RAUMBOARD_INSTANCE=hosted npm run cli -- list
```

No deployment's configuration is a file in the working tree this way, which is
what keeps the public repo free of the operator's hosts, domains and tenants.
The same rule applies to school data: `data/` is gitignored, and seeds carry
generated dummy names only (see „Privacy rule").

## Deploy

The app self-hosts as a Node/Hono server (SQLite per tenant, WebSockets) behind a
reverse proxy that terminates TLS. Env config lives in a server-side `.env` (session
secret, base domain, backup credentials — never in the repo), documented in
[`.env.example`](.env.example). Per-school DBs back up nightly to object storage.
A Docker/Compose self-hosting path is the Phase-4 goal.

**Static demo:** `npm run build` produces a `dist/` that runs in demo mode
(frontend-only localStorage store), suitable for any static host.
