# lernraum-board

Room-booking board for Beispielschule (primary school, NRW). During the
first three lessons of the day, kids book themselves out of their classroom into
learning spaces (Lernateliers, library, hallway desks, garden, foyer). Boards run
on digital classroom whiteboards, PCs, and iPads via plain URLs. Replaces a
macro-based Excel sheet maintained by the principal.

## Status / roadmap

- **Phase 1 (current):** clickable UI prototype, deliberately unstyled, no backend.
  State lives in `localStorage`; cross-tab sync via the `storage` event simulates
  realtime for demos.
- **Phase 2:** TypeScript fetch-handler API (locally via Deno on port 3211),
  deployed to Bunny Edge Scripting; WebSockets for push; Bunny Database (libSQL).
- **Phase 3:** static frontend on Bunny CDN, nightly DB dump to Bunny Storage,
  handover docs for the school.
- **Phase 4:** kid-friendly styling (large touch tiles, room colors), auto-reset.

## Privacy rule (hard)

Never commit real children's names. Seeds and fixtures use generated dummy names
only (emoji symbol + first name + last-name initial, mirroring the original
sheet's structure). The school enters real data in production only.

## Architecture

- Vite + React 19 + TypeScript, no runtime deps beyond react/react-dom.
  No router package (tiny hash router), no state package (own store).
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

`npm run dev` runs `scripts/dev-prep.sh` (port-conflict check) first. PM2 uses
`npm run dev:pm2` (no prep script). Local HTTPS URL: `https://lernraum.localhost`
(Caddy, see `~/Development/.dev-stack/`).
