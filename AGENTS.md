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
- **Auth:** per school one teacher PIN that unlocks boards per device and carries
  the Verwaltung, plus one admin login for the Excel/CSV import. Kids never log
  in. Onboarding and reset are manual by the operator in the early phase. See
  „Auth: PIN and login" below.
- **Data minimization:** first name + initial only, never full names.
- **AVV/DSGVO:** hosting for schools makes the hosting operator an
  Auftragsverarbeiter even when free — AVV template + TOM doc required before the
  first real kid data. Templates live in `docs/`.
  [`scripts/build-avv-pdf.sh <schule-slug>`](scripts/build-avv-pdf.sh) turns them
  into one signable PDF. The party details of a school (its name, its address, the
  operator's private address) are values, not template edits, so they live outside
  the repo in `~/.config/raumboard/avv/<slug>.env`, in the same `KEY=value` shape
  as an instance profile and read by the same loader. A value that is missing
  leaves its placeholder standing in the PDF and warns, which is visible while
  proofreading; a plausible default would not be.

## Auth: PIN and login

Who needs which secret is in [`README.md`](README.md); this is the mechanism.
Both secrets are scrypt hashes in the tenant's `config` table
([`server/auth.ts`](server/auth.ts)), both are carried by HMAC-signed stateless
cookies (no session store), and neither can stand in for the other.

| | Teacher PIN | Admin login |
| --- | --- | --- |
| Secret | 4 to 8 digits (6 when generated), `pin_hash` | email + password, `admin_email` / `admin_hash` |
| Endpoint | `POST /api/pin` | `POST /api/login` |
| Cookie / TTL | `rb_board`, 180 days | `rb_admin`, 30 days |
| Unlocks | `/api/book`, `/api/unbook`, `/api/reset` and the Verwaltung: `/api/rooms`, `/api/kids`, `/api/klasses`, `/api/verify-password`, `/api/change-password`, `/api/change-pin` | everything under `/api/admin/*`, which is `POST /api/admin/import` and nothing else |

**The dividing line is bulk.** The import is the one mutation that brings personal
data in from outside and can replace the whole school's data in a single step
(`mode: 'replace'`), and it happens about once a year, at the start of the school
year, with the responsible person sitting in front of the list. Everything else in
the Verwaltung is single-record editing: one room, one class, one child, visible
and individually repairable. So `/api/admin/` as a path prefix means „needs the
login", and the CRUD routes live one level up without it.

The server derives `canOperate = isAdmin || hasBoard` ([`server/index.ts`](server/index.ts)),
which is the whole interplay:

| Cookies held | Book on a board | Verwaltung: rooms, classes, kids | Import and Zugangsdaten |
| --- | --- | --- | --- |
| PIN only | yes | yes | the password opens the screen; the import itself still needs the login |
| login only | yes | API yes, but the screen asks for the PIN first | yes, after the password |
| both | yes | yes | yes, after the password |

Consequences worth knowing before touching this:

- **The Verwaltung asks for the PIN on every entry**, and an admin session does
  not skip it. The boards run on a whiteboard the children operate themselves and
  both cookies outlive a school day by design, so nothing persisted may leave
  `#/admin` one tap away for a class. The gate is component state in
  [`src/views/Admin.tsx`](src/views/Admin.tsx), not a cookie: switching tabs
  inside the page keeps it open, leaving or reloading the page locks it again.
- **„Kinder importieren" and „Zugangsdaten" ask for the school's password before
  they open**, by the same means and for the same reason: one brings personal data
  in from outside, the other holds the keys to the school, and a 30-day session
  cookie may not be what opens either. `PASSWORD_TABS` in
  [`src/views/Admin.tsx`](src/views/Admin.tsx) names them, the prompt is
  [`src/PasswordGate.tsx`](src/PasswordGate.tsx), and one confirmation covers both
  tabs until the page is left.
- **The confirmed password is handed to the credential forms**, so „Passwort
  ändern" asks for the new password only and „Lehrkraft-PIN ändern" for the new
  PIN. The server still requires the current password in the body; the gate has
  it, and asking twice for one secret is what made the old login-in-front feel
  pointless.
- **Signing in and out of the account happens on the start page**, next to
  „Verwaltung" ([`src/views/Home.tsx`](src/views/Home.tsx)). The same
  `PasswordGate` serves both jobs: with a session it verifies the password, and
  without one it asks for the email too and signs in, since a session that does
  not exist yet cannot be confirmed. Opening a protected tab while signed out
  therefore signs in and opens it in one step.
- **The gate's PIN entry sets `rb_board` too**, since it posts to the same
  endpoint as the board gate. Opening the Verwaltung on a fresh whiteboard
  therefore unlocks that device for booking as well.
- **The Feierabend-Reset re-asks for the PIN as well**, for the same reason and
  by the same means ([`src/DayEndReset.tsx`](src/DayEndReset.tsx)). It wipes the
  occupancy of the whole school and sits on the start page, so on an unlocked
  whiteboard a confirm dialog would put it one tap and one „OK" away for a class.
  The PIN entry *is* the confirmation there; no second dialog follows it.
- **Deleting a class is the one PIN-level deletion that takes children with it**,
  so its confirm names their number instead of saying „samt allen Kindern".
- **`POST /api/change-pin`, `/api/change-password` and `/api/verify-password` all
  check the admin password in the body**, which is why they sit on the PIN level:
  the password is the proof, and a login in front of them would ask for the same
  secret twice. The PIN cannot promote itself that way, since changing it needs
  the password. `verify-password` answers the question and changes nothing: no
  cookie, no config write. The price is that password guessing is reachable with
  the PIN, so all three share one throttle: five failures per board per 15
  minutes, in memory, cleared on success.
- **`POST /api/logout` ends the admin session only, `POST /api/lock` drops both
  cookies.** „Abmelden" on the start page must not lock the whiteboard a class
  books on. „Dieses Gerät sperren" in the Zugangsdaten tab is the `lock` call.
- **A new PIN cannot invalidate `rb_board`**, because the token is signed and
  carries an expiry with no reference to the PIN hash. That is deliberate, since
  the alternative locks every whiteboard in the school mid-year. Revoking one
  device means `POST /api/lock` from it, so a „reset all devices" feature would
  need a tenant-wide token epoch first.

[`server/access.test.ts`](server/access.test.ts) drives the whole matrix through
the real app: no cookie changes nothing, the PIN opens the Verwaltung and is
refused by the import, the password check that changes nothing, the credential
endpoints and their shared throttle, and which cookie each sign-off clears. It
imports `app` from `server/index.ts` with
`RAUMBOARD_NO_LISTEN=1`, which is what stops that import from binding a port.

Provisioning and recovery live in [`server/cli.ts`](server/cli.ts) and print the
secrets to stdout only.

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

## Form of address (German UI)

The boards address the children informally („Wohin gehst du?"). Everything an
adult uses (Verwaltung, login, teacher PIN, import) uses „Sie", or stays
impersonal where no address is needed („Passwort bestätigen"). An admin-side
string that duzt is a bug.

## Checks

`npm test` (node:test over `server/**/*.test.ts`), `npm run lint` (oxlint), and
`npm run build`, which is the typecheck: `tsconfig.json` is a solution file with
`files: []`, so a bare `tsc --noEmit` resolves it, checks zero files and reports
success. Only `tsc -b`, inside `npm run build`, walks the three project references.

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

## Schema migrations

The schema is an **ordered set of files** in `server/migrations/`
(`NNNN_lower_snake_case.sql`, filename order = apply order), tracked per tenant
database in a `schema_migrations` table. Shipping a schema change means adding a
file. Before this, `migrate()` knew a single step (empty file → `schema.sql` →
`user_version = 1`), so any *later* change would have sat there unnoticed.

**It applies automatically when a tenant database is opened**, which is the
opposite of the convention's Postgres example, and deliberate: this process owns
these files exclusively, SQLite has a single writer, and a school's database is
created lazily the first time it is served. There is no fixed list of databases to
migrate in advance, so a "run the CLI first" gate would be an operator task per
school, including schools that did not exist at deploy time. Ordered, tracked and
transactional it still is; only the trigger differs, and it may differ *because* the
app owns the store exclusively.

Auto-applying is only safe because it never guesses:

- **A database newer than the code is refused, loudly.** A tracking row naming a
  migration this build does not have means someone rolled the code back. Serving it
  would write through a schema we misunderstand, so `openTenant` throws instead.
  There is no downgrade path.
- **One transaction per file, tracking row included**, so a failure leaves neither a
  half-applied schema nor a row claiming success (tested).
- **Names are validated on every open.** A duplicate number is refused, because two
  branches that each grab `0002_` merge cleanly in git and then run in alphabetical
  order of their names, which neither author intended. Gaps are fine: renumbering
  renames a file live databases already record as applied.

**Adding one:** drop `000N_what_it_does.sql` into `server/migrations/`. No BEGIN or
COMMIT (the runner wraps it, and better-sqlite3 rejects a nested transaction). Name
a destructive change `..._breaking.sql`, which makes it visible in review and logs a
warning when it runs. A one-off data cleanup is **not** a migration: a migration is
replayed by every database forever, a cleanup happened once to one dataset, so it
belongs in `scripts/`.

Databases from before the tracking table are **adopted automatically**: they carry
`user_version = 1`, which had exactly one meaning, so `0001_init.sql` is recorded as
applied without being re-run.

`npm test` covers all of this ([`server/migrations.test.ts`](server/migrations.test.ts))
against real SQLite files, including adoption, the downgrade refusal and the
rollback of a failing migration.

## Booking rules

A kid can book into a room iff the room `isOpen`, has free capacity, and its
`scope` is `'all'` or equals the kid's class. Booking out sets
`currentRoomId = null`. Global reset ("Feierabend-Reset") sets every kid to `null`.

The reset is a daily action of the teaching staff, so it sits at the foot of the
start page next to „Verwaltung" rather than inside it: it changes today's
occupancy, while the Verwaltung is about rooms, classes and kids. It only renders
while at least one kid is out, because with everyone in their classroom there is
nothing to put back. `POST /api/reset` matches that placement, needing only
`canOperate`.

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
| 3216  | Vite dev server, instance `demo`          |
| 3217  | API server, instance `demo`               |

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
RAUMBOARD_INSTANCE=hosted npm run cli -- create-school lindenschule "Lindenschule" admin@example.org --seed
RAUMBOARD_INSTANCE=hosted npm run cli -- list
```

No deployment's configuration is a file in the working tree this way, which is
what keeps the public repo free of the operator's hosts, domains and tenants.
The same rule applies to school data: `data/` is gitignored, and seeds carry
generated dummy names only (see „Privacy rule").

## Public demo (credentials may be published)

`RAUMBOARD_DEMO_TENANT=<slug>` turns that subdomain into a demo whose login and
teacher PIN can go on a website: **one throwaway board per visitor, held in RAM,
never written to disk.** No `data/<slug>.db` exists for it, so there is nothing
to back up, nothing to erase, and no personal data on the server to have an AVV
question about. Everything lives in [`server/demo.ts`](server/demo.ts).

The board id is what carries this. A school's id is its slug; the demo's is
`<slug>#<session>`, taken from a `rb_demo` cookie the page load mints. SQLite
handle, WebSocket registry and the signed auth cookies are all keyed by that id,
which is what keeps two visitors apart without a second code path.

- **Per visitor, not per device.** Tabs of one browser share the board and the WS
  broadcast; a phone next to the whiteboard is a different session. The
  "book here, watch it appear there" demo therefore only works within one browser.
- **Reset is public.** `POST /api/reseed` needs no login on a demo board (it is
  the visitor's own copy) and restores the seed *and* the published credentials,
  in case someone changed the password in Verwaltung. The floating „Demo
  zurücksetzen" button in [`src/App.tsx`](src/App.tsx) calls it; it shows when
  `/api/state` reports `meta.ephemeral`. On a school's board the same endpoint is
  refused with 403, so children's data can never be wiped through it.
- **Boards expire.** Idle past `RAUMBOARD_DEMO_IDLE_MINUTES` (60) they are
  dropped by a sweeper, and beyond `RAUMBOARD_DEMO_MAX_BOARDS` (200) the least
  recently used one gives way, so a crawler minting sessions cannot grow the heap.
- **Two configurations are refused at startup**, because both would look like they
  work: a demo slug that has a database file (it would shadow a real school), and
  a demo slug in self-hosted mode that differs from `RAUMBOARD_DEFAULT_TENANT`
  (the demo host would be unreachable). Setting both to the same slug is the
  supported way to make a whole instance a demo — that is what the local `demo`
  instance does (`RAUMBOARD_INSTANCE=demo npm run dev`, http://localhost:3216).

Credentials and school name come from `RAUMBOARD_DEMO_LOGIN` / `_PASSWORD` /
`_PIN` / `_NAME`, defaulting to `demo@raumboard.de` / `raumboard-demo` / `1234` /
„Demoschule". On a demo board `/api/state` returns them as `meta.demoCredentials`
(null for a school), and the login form and the PIN gate prefill themselves from
it: a visitor came to see the product, not to copy credentials off a website. The
gate still has to be confirmed, so both steps stay visible — filling the slots
programmatically does not submit them. `npm test` covers the isolation, the empty data directory, the
reset, expiry and both startup refusals
([`server/demo.test.ts`](server/demo.test.ts)).

## Deploy

The app self-hosts as a Node/Hono server (SQLite per tenant, WebSockets) behind a
reverse proxy that terminates TLS. Env config lives in a server-side `.env` (session
secret, base domain, backup credentials — never in the repo), documented in
[`.env.example`](.env.example). Per-school DBs back up nightly to object storage.
A Docker/Compose self-hosting path is the Phase-4 goal.

**Static demo:** `npm run build` produces a `dist/` that runs in demo mode
(frontend-only localStorage store), suitable for any static host.

Operator-specific notes for the maintainer's own hosted instance (server layout,
where the CLI writes the credentials it printed, backup migration steps) live in
`DEPLOY.local.md`, which is untracked by design.

**A deploy does not publish anything.** It rsyncs a locally built tree to the
server over SSH; the public repo is a separate step and a separate history.

## Publishing to the public repo

The public repo has **no common ancestor** with the development history, and
must not get one. Development commits from before 2026-08-02 carry the pilot
school's name and slug, a handover mail naming a school's head with their work
address, and the operator's server alias. Those were removed from the tree,
which leaves them in the commits: pushing the development branch would publish
all of it. The current tree is clean, so publishing copies the **tree**, never
the history.

[`scripts/publish.sh`](scripts/publish.sh) does that, and pushes nothing:

```bash
bash scripts/publish.sh --dry-run    # what would be published
bash scripts/publish.sh              # one commit on `publish`, then stops
git push public publish:main         # your call, separately
```

It reads the tree of a **ref** rather than the working directory, so an
unrelated work-in-progress in the checkout cannot end up in a release, and it
writes one commit on `publish` whose parent is the previously published one.

- **It refuses on the pattern list**, `~/.config/raumboard/publish-guard.txt`
  (one case-insensitive regex per line), and refuses just as hard when that file
  is missing: no check must ever look like a passed check. The list names the
  private things, so it lives outside the repo like an instance profile.
- **The published commit records its source** as a `Raumboard-source:` trailer.
  That is how the next run knows the range to summarize, so the public repo
  carries its own bookkeeping and no state lives beside git.
- **An identical tree is a no-op**, and `git update-ref refs/heads/publish <old>`
  undoes a release that has not been pushed yet.
