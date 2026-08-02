# Raumboard

A room-booking board for primary schools with open learning concepts
("Pädagogische Architektur"). During self-directed learning time, kids book
themselves out of their classroom into learning spaces — Lernateliers, the
library, hallway desks, the garden, the foyer — by tapping their symbol on a
shared board. Boards run on classroom whiteboards, PCs, and iPads via plain
URLs; kids never log in.

Raumboard is the daily-operations layer of Pädagogische Architektur: a live
answer to "who is learning where right now".

## Status

Early, iterating fast. Two tracks:

- **Open source** — this repo, self-hostable (marked experimental, no support
  while the product is young).
- **Hosted, free** — one deployment serving multiple schools, run by the
  maintainer. See `AGENTS.md` for the target architecture.

## Quick start (static demo)

```bash
npm install
npm run build      # produces dist/ (demo mode: frontend-only, localStorage)
npm run preview    # serve the build locally
```

The demo build has no backend: state lives in the browser and syncs across tabs.
It runs on any static host and doubles as an offline showcase.

## Local development (full stack)

`npm run dev` starts the Hono API server and Vite together in API mode with HMR.
In dev the server auto-provisions a `dev` tenant with seed data and fixed local
credentials:

- Login: `dev@raumboard.local` / `raumboard`
- Teacher PIN: `0000`

```bash
npm run dev        # API + web, API mode
npm run dev:demo   # frontend-only localStorage mode
npm run lint       # oxlint
```

## Architecture

Vite + React 19 + TypeScript on the frontend; Hono + SQLite (one file per
school) + WebSockets on the backend. Tenants are addressed by subdomain, with no
tenant columns anywhere. The store interface in `src/store.ts` is the contract
shared by the demo store and the API store.

The domain model, booking rules, ports, and deployment shape are documented in
[`AGENTS.md`](AGENTS.md). Self-hosting scripts live in `deploy/` and are
configured entirely through environment variables.

## Privacy

Data minimization is the core design decision. Per child, Raumboard stores only
a first name plus a last-name initial ("Mina K."), the class, a chosen emoji,
and the current learning space. No full surnames, birth dates, addresses,
contact details, grades, or support needs. The Excel/CSV import shortens the
surname to an initial in the browser — the full surname never reaches the server.

Seeds and fixtures use generated dummy names only; real children's data is
entered by the school in production. AVV (Art. 28 GDPR) and TOM templates for
operators are in [`docs/`](docs/).

## License

[MIT](LICENSE).
