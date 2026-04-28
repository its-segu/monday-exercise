# Candle Gift Box Production Builder

A monday.com app that streamlines order intake and production tracking for a
corporate candle gift box business. Designers can spin up a new gift-box order
in seconds; production sees a Kanban board of in-flight orders and can drag
work across stages without ever leaving monday.

## What's in the app

- **Kanban Board View** — groups orders by status (New Order → Working on
  it → Ship → Done / Stuck) with drag-and-drop between columns.

- **Drag-and-drop** — drag cards to change status (optimistic UI, rolls
  back on failure). Columns are also reorderable via drag.

- **Order intake modal** — three-section form (customer, 3 fragrance
  picks, quantity + inscription). Creates an item on the Production
  Orders board on submit.

- **Order details + recipe view** — click a card to see order details;
  tap a candle's arrow to slide into a recipe pane showing Top / Heart /
  Base ingredient tiers pulled from the Fragrance API.

- **Analytics modal** — turnaround time, on-time rate, throughput chart,
  and past-SLA list. Derived from `activity_logs`, no extra board columns
  needed. SLA clock stops at Ship so transit doesn't penalize production.

- **Fragrance CRUD API** — Express service on monday-code backed by
  `@mondaycom/apps-sdk` Storage. Seeds 16 fragrances on boot. Falls back
  to in-memory for local dev.

- **Automation** — no-code automation: when status changes to "New Order",
  notify board subscribers.

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │         Production Orders board         │
                    │                                         │
                    └────┬────────────────────────────────┬───┘
                         │                                │
            our Board View tab                native Item Card panel
                         │                                ▲
                         ▼                                │
   ┌──────────────────────────────────────┐               │
   │      frontend/  (Vite + React)       │  monday.execute("openItemCard")
   │   - KanbanView, OrderCard            │───────────────┘
   │   - OrderModal (intake form)         │
   │   - OrderDetailsModal (rich view)    │
   │   - AnalyticsModal (SLA + throughput)│
   │   - dnd-kit drag-and-drop + sortable │
   │   - Vibe components only             │
   └─────┬────────────────────┬───────────┘
         │                    │
   monday.api (GraphQL)   fetch /api/fragrances
   create_item /              │ (vite proxies /api/* → localhost:8080
   change_simple_column_value │  in dev; deployed URL in prod)
   items_page                 │
   activity_logs              ▼
         │         ┌────────────────────────────┐
         │         │  backend/ (Express, monday-code)
         │         │  GET/POST/PATCH/DELETE /fragrances
         │         │  Storage (apps-sdk) ─→ in-memory fallback
         ▼         └────────────────────────────┘
  Production Orders board (item rows)
```

## Monday APIs & components used (end-to-end)

Walk through the user journey from a phone call to shipped analytics.
Every monday surface we touch is annotated inline so a reviewer can trace
the platform inventory at a glance.

### 1. The board view loads inside monday's iframe

- `monday-sdk-js` initialized once in `lib/monday.js`
- `monday.execute("valueCreatedForUser")` — the value-created handshake
- `monday.listen("context")` — receives the `boardId` from the parent tab
- `monday.listen("events")` — subscribes to mutation events (`new_items`,
  `change_column_values`, `change_specific_column_value`,
  `change_status_column_value`, `delete_items`) for live refresh
- Vibe shell: `Heading`, `Text`, `Loader`, `AttentionBox`, `Button`

### 2. Designer queries the board to render the kanban

- `monday.api()` GraphQL — `boards.items_page` paginated query for orders
- Schema-version-agnostic: pulls `column_values { id, type, text, value }`
  and parses raw JSON in `boardQueries.normalizeItem` — avoids typed
  fragments (`... on StatusValue`) so the query works regardless of which
  API version the iframe proxy is pinned to

### 3. Designer hits "+ New order" — intake modal

- Vibe components: `Modal`, `ModalContent`, `Button`, plus our
  `CustomerSection`, `FragranceSection`, `DetailsSection`
- Catalog read: `GET /fragrances` against our monday-code backend
  (Express + `@mondaycom/apps-sdk` Storage), with a bundled fallback
  catalog if the API is unreachable

### 4. Submit — order lands on the live Production Orders board

- `monday.api()` — `create_item` mutation (just the name, kept minimal
  for cross-version compatibility)
- `monday.api()` — sequential `change_simple_column_value` mutations for
  every column, with `create_labels_if_missing: true` so any fragrance
  added through the backend's CRUD API is auto-adopted as a board label
- `monday.execute("notice")` — Vibe toast for success/warning/error feedback

### 5. monday's no-code automations fire

An automation runs on the live Production Orders board, configured in
monday's no-code Automate menu — no automation code in this repo.
See [Automation setup](#automation-setup-manual-in-mondays-ui).

- _When status changes to **New Order**, notify **subscribers** that
  **{Item Name}** needs production._

monday's automation engine watches the event stream and fires the
notification without any code from us.

### 6. Production manager works through the pipeline

- Drag-and-drop (`@dnd-kit/core` PointerSensor + KeyboardSensor) →
  `monday.api()` `change_simple_column_value` on the status column
- Columns are drag-reorderable (`@dnd-kit/sortable`); order persists
  in `localStorage`
- Optimistic UI; rolls back to the previous status on API failure
- Click a card → `OrderDetailsModal` (Vibe `Modal`) with a master-detail
  slide layout — candle list on the left, recipe pane on the right — reads
  fragrance metadata from `GET /fragrances` and renders tier-based
  ingredient cards
- "Open in Monday" button calls `monday.execute("openItemCard")` to hand
  off to monday's first-party item panel for files, comments, native
  columns, and any board-level automations

### 7. Designer checks performance — Analytics button

- `monday.api()` GraphQL — `boards.activity_logs` (last 90 days, scoped
  to the status column only) — used to derive `completed_at` per order
  _without_ adding a board column
- Same `items_page` query for the live pipeline snapshot
- `lib/sla.js` computes turnaround, on-time rate, throughput per day, and
  the past-SLA list entirely client-side — single round-trip, no backend
- Hand-rolled flexbox bars for the throughput chart so we don't pull in a
  charting library

### Flat reference of every monday surface touched

| Layer                                      | Surfaces                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **monday SDK** (`monday-sdk-js`)           | `monday.api()`, `monday.execute()`, `monday.listen()`                                                 |
| **GraphQL API**                            | `boards`, `items_page`, `column_values`, `activity_logs`, `create_item`, `change_simple_column_value` |
| **monday-code platform**                   | hosts the Fragrance API (Express service)                                                             |
| **monday Storage** (`@mondaycom/apps-sdk`) | persists fragrances; in-memory fallback for local dev                                                 |
| **monday CDN**                             | hosts the client-side bundle (via `mapps code:push --client-side`)                                    |
| **monday tunnel** (`mapps tunnel:create`)  | dev-time HTTPS exposure for the Vite server                                                           |
| **monday Vibe**                            | `Modal`, `ModalContent`, `Button`, `Heading`, `Text`, `Loader`, `AttentionBox`, plus form primitives  |
| **monday no-code Automations**             | new-order notification on the live Production Orders board                                            |
| **monday OAuth scopes**                    | `boards:read`, `boards:write`, `me:read` (deployed installs)                                          |
| **monday Item Card**                       | reused for native editing via `monday.execute("openItemCard")`                                        |

### Where the column IDs and status labels came from

The constants in
[`frontend/src/api/boardConstants.js`](frontend/src/api/boardConstants.js)
were captured by running `getBoardSchema()` against the live "Production
Orders" board (id `18410280508`). If you install the app on a different account, re-run that
helper and update the constants — see
[Updating column IDs](#updating-column-ids).

## Repo layout

```
.
├── frontend/        # Custom Board View (Vite + React + Vibe)
│   ├── src/
│   │   ├── api/             # boardQueries, boardConstants, fragrancesApi
│   │   ├── components/
│   │   │   ├── KanbanView/        # board, columns, cards, drag overlay
│   │   │   ├── OrderModal/        # intake form
│   │   │   ├── OrderDetailsModal/ # rich card detail view
│   │   │   └── AnalyticsModal/    # SLA, throughput, past-SLA list
│   │   ├── data/fragrances.js     # bundled fallback catalog
│   │   └── lib/                   # monday sdk singleton, validators, sla math
│   └── vite.config.js             # /api proxy → http://localhost:8080
├── backend/         # Fragrance CRUD API (Express + apps-sdk Storage)
│   └── src/
│       ├── routes/health.js, fragrances.js
│       ├── services/fragranceStore.js   # Storage (or in-memory fallback)
│       └── seed/seedFragrances.js
├── .env.example     # single source of truth; copy sections into
│                    #   frontend/.env (Vite) and backend/.env (dotenv)
├── .gitignore       # one root file applied recursively
└── README.md
```

## Commands at a glance

A cheat sheet of every command you'll run, grouped by intent. Detailed
walkthroughs follow below.

### Run locally (three processes, three terminals)

```bash
# Terminal 1 — Express backend (Fragrance API) on :8080
cd backend && npm start

# Terminal 2 — Vite dev server (board view) on :8301
cd frontend && npm run server

# Terminal 3 — public HTTPS tunnel into Vite, for monday's iframe
cd frontend && npx mapps tunnel:create -p 8301
```

### Run locally (one terminal, no monday iframe)

```bash
cd backend && npm start            # backend on :8080
cd frontend && npm start           # combined: vite + tunnel via concurrently
```

### Smoke-test that everything's wired

```bash
curl http://localhost:8080/health           # backend liveness
curl http://localhost:8301/api/fragrances   # frontend → backend (proxied, 16 fragrances)
curl https://<tunnel-url>/api/fragrances     # tunnel → frontend → backend
```

### Deploy to monday-code

```bash
cd frontend && npm run deploy   # vite build + mapps code:push --client-side -d build
cd backend && npm run deploy    # mapps code:push  (server-side service)
```

If `mapps code:push` reports "the latest app version is live" and refuses
to overwrite, either create a new draft version in the Developer Center,
or pass `--force`:

```bash
cd frontend && npx mapps code:push --client-side -d build -a <APP_ID> --force
```

### One-time machine setup

```bash
npm install -g @mondaycom/apps-cli
mapps init -t YOUR_PERSONAL_MONDAY_API_TOKEN
cd backend  && npm install
cd frontend && npm install
```

---

## Local dev

The app runs as **three independent processes**: backend, vite dev server,
and the mapps tunnel that exposes vite over HTTPS to monday.

### One-time setup

```bash
# Install the Mapps CLI globally (once per machine)
npm install -g @mondaycom/apps-cli

# Authenticate the CLI with a personal monday API token
mapps init -t YOUR_PERSONAL_MONDAY_API_TOKEN
```

Then per-package:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### Env files

There are two `.env` files (one per process), because Vite and the backend's
`dotenv/config` each load from their own package directory. The root
[`.env.example`](.env.example) documents every variable for both — copy the
relevant block into each:

```bash
# backend/.env  → PORT, optional MONDAY_TOKEN
# frontend/.env → VITE_FRAGRANCE_API_URL, optional VITE_DEV_BOARD_ID + VITE_DEV_API_TOKEN
```

`MONDAY_TOKEN` in `backend/.env` is **optional** — leave it empty and the
backend uses an in-memory store. Set it to persist fragrances via monday's
Storage.

`VITE_DEV_BOARD_ID` / `VITE_DEV_API_TOKEN` are **only** used when you open
the tunnel URL directly in a browser (no monday iframe → no context event).
Inside monday they are ignored.

### Run it (three terminals)

```bash
# Terminal 1 — Express backend on :8080
cd backend
npm start

# Terminal 2 — Vite dev server on :8301
cd frontend
npm run server

# Terminal 3 — public HTTPS tunnel → :8301
cd frontend
npx mapps tunnel:create -p 8301
```

`mapps tunnel:create` prints a URL like
`https://e816627798c4.apps-tunnel.monday.app`. Vite proxies `/api/*` from
that URL to `http://localhost:8080`, so the frontend, backend, and tunnel
all share one HTTPS origin — no CORS, no mixed-content errors.

### Verify it's wired up

```bash
curl http://localhost:8080/health             # → {"status":"ok",...}
curl http://localhost:8301/api/fragrances     # → 16 fragrances (proxied)
curl https://<tunnel>/api/fragrances           # → same, over HTTPS
```

In Developer Center, point the board view feature at the tunnel URL, install
the app on the workspace, and add a tab to the Production Orders board.

## Deploy

```bash
# Frontend → monday CDN
cd frontend
npm run deploy             # vite build + mapps code:push --client-side -d build

# Backend → monday-code
cd ../backend
npm run deploy             # mapps code:push
```

### App version model

`mapps code:push` writes to whichever app version is currently the latest
draft. You **create** new app versions in the Developer Center (Build →
Versions → "+ New version"); the CLI can only list and push. Once a version
is promoted to **Live**, you can keep pushing fresh bundles to it — the URL
on the Feature is stable per-version, but each push creates a new immutable
build artifact behind it (visible via `mapps app-version:builds -i <id>`).

### Production env vars

The deployed frontend needs to talk to the deployed backend, not localhost:

```bash
# frontend/.env.production.local  (gitignored, only loaded by `vite build`)
VITE_FRAGRANCE_API_URL=https://<your-monday-code-backend>.monday.app

# Belt-and-suspenders: ensure no dev token leaks into the production bundle
VITE_DEV_API_TOKEN=
VITE_DEV_BOARD_ID=
```

The dev-token guard in `lib/monday.js` already short-circuits in production
builds (`import.meta.env.DEV`), so the second block is purely defensive.

### OAuth scopes

The deployed app authenticates via OAuth (not your personal token). In the
Developer Center → **Build → OAuth & Permissions**, add:

- `boards:read` — required for `items_page`
- `boards:write` — required for `create_item` and `change_simple_column_value`
- `me:read` — optional, used by the SDK to identify the current user

If you skip these, deployed installs will fail with
`"Unauthorized field or type"` on every monday.api call.

### Going live

1. In the Developer Center, set the board view feature's URL to the deployed
   CDN URL (printed by `mapps code:push --client-side`).
2. Promote the draft to **Live**. The app then appears in the workspace's
   App Marketplace, ready to install on a board.

## Updating column IDs

The Kanban talks to the board via column IDs hard-coded in
[frontend/src/api/boardConstants.js](frontend/src/api/boardConstants.js).
These were captured by running `getBoardSchema()` (in
[frontend/src/api/boardQueries.js](frontend/src/api/boardQueries.js))
against the live Production Orders asset. If you install the app on a board
with different IDs:

```js
import { getBoardSchema } from "./api/boardQueries";
const schema = await getBoardSchema(boardId);
console.log(schema.columns);
```

Then paste the IDs into `boardConstants.js` and re-deploy the frontend.

## Solution highlights

- **No custom orders database** — orders persist as monday board items.
  Permissions, real-time updates, comments, and file attachments come for
  free.
- **No custom fragrance database** — uses monday-code Storage, with an
  in-memory fallback for frictionless local dev.
- **Native UX** — Vibe components throughout; the board view feels like a
  first-party monday feature.
- **Replaces _and_ extends the table experience** — the custom Order
  Details modal pulls fragrance metadata into a master-detail recipe view
  the table can't show (Top / Heart / Base ingredient tiers parsed from the
  fragrance description), while a "View in monday" button still hands off
  to the native Item Card for first-party editing.
- **Catalog ↔ board sync** — the create-order mutation passes
  `create_labels_if_missing: true` to the dropdown column, so any fragrance
  added through the backend's CRUD API is automatically adopted as a valid
  board label the first time it's selected. No manual schema edits.
- **Resilient by design** — the frontend ships a bundled fragrance catalog
  it falls back to whenever the API is unreachable, so the Kanban never
  breaks even if the backend is down.
- **Schema-version-agnostic queries** — `getOrderItems` uses the universal
  `column_values { id, type, text, value }` fields and parses the raw JSON
  in client code, avoiding typed fragments that depend on a specific API
  version. Works regardless of which version the iframe proxy is pinned to.

