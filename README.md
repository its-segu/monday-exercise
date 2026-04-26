# Candle Gift Box Production Builder

A monday.com app that streamlines order intake and production tracking for a
corporate candle gift box business. Designers can spin up a new gift-box order
in seconds; production sees a Kanban board of in-flight orders and can drag
work across stages without ever leaving monday.

Built as a take-home assessment for monday.com.

## What's in the app

- **Custom Board View — "Production Pipeline"**: a purpose-built Kanban that
  groups items by status, renders order-shaped cards (customer + fragrance
  chips + qty + relative time), and exposes a primary "+ New order" action on
  the first column.
- **Drag-and-drop status updates** (`@dnd-kit/core`): drag a card across
  columns to call `change_simple_column_value` on the status column.
  Optimistic UI; rolls back on failure.
- **Order intake modal**: a Vibe-native modal form with three sections —
  Customer info, Fragrance selections (3 distinct picks), and Order details
  (quantity + optional inscription). Validation runs locally and submit uses
  `create_item` against the live Production Orders board.
- **Custom Order Details modal**: clicking a card opens a Vibe modal that
  pulls fragrance metadata (image, category, scent description) from the
  Fragrance API and renders it as a rich ingredient card. A "View in monday"
  button hands off to `monday.execute("openItemCard")` for first-party editing
  (status, dates, files, comments, automations).
- **Fragrance CRUD API** on monday-code: tiny Express service backed by
  `@mondaycom/apps-sdk` Storage. Auto-seeds 10 starter fragrances on first
  boot. Falls back to an in-memory store when no `MONDAY_TOKEN` is set so the
  backend Just Works for local dev.
- **Automation**: configured in monday's no-code automation builder (see
  below) — fires when status flips to "New Order" and notifies the production
  manager.

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │         Production Orders board         │
                    │  (asset provided by the prompt)         │
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
   │   - dnd-kit drag-and-drop            │
   │   - Vibe components only             │
   └─────┬────────────────────┬───────────┘
         │                    │
   monday.api (GraphQL)   fetch /api/fragrances
   create_item /              │ (vite proxies /api/* → localhost:8080
   change_simple_column_value │  in dev; deployed URL in prod)
   items_page                 ▼
         │         ┌────────────────────────────┐
         │         │  backend/ (Express, monday-code)
         │         │  GET/POST/PATCH/DELETE /fragrances
         │         │  Storage (apps-sdk) ─→ in-memory fallback
         ▼         └────────────────────────────┘
  Production Orders board (item rows)
```

## Repo layout

```
.
├── frontend/        # Custom Board View (Vite + React + Vibe)
│   ├── src/
│   │   ├── api/             # boardQueries, boardConstants, fragrancesApi
│   │   ├── components/
│   │   │   ├── KanbanView/        # board, columns, cards, drag overlay
│   │   │   ├── OrderModal/        # intake form
│   │   │   └── OrderDetailsModal/ # rich card detail view
│   │   ├── data/fragrances.js     # bundled fallback catalog
│   │   └── lib/                   # monday sdk singleton, validators
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
curl http://localhost:8301/api/fragrances     # → 10 fragrances (proxied)
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

After deploying:

1. In the Developer Center, set the board view feature's URL to the deployed
   CDN URL printed by `mapps code:push --client-side`.
2. Set the frontend's `VITE_FRAGRANCE_API_URL` to the deployed monday-code
   backend URL and re-deploy the frontend.
3. Promote the draft to **Live** so the app is published to the workspace.

## Automation setup (manual, in monday's UI)

The take-home asks for "at least one automation." This is configured in
monday's no-code automation builder, not in code:

1. Open the **Production Orders** board.
2. Click **Automate** → **Create custom automation**.
3. Choose the recipe:
   `When status changes to [New Order], notify [Production Manager] that
    [Item Name] needs production`.
4. Save. New orders created via our Kanban modal automatically trigger the
   notification because they land on the board with status set to "New Order".

Other recipes that work well with this board:

- `When status changes to Done, set Order Complete Date to today` — drives
  the "Order Turnaround" formula column.
- `Every day at 9:00 AM, notify [Production Manager] that orders in [Stuck]
  need attention`.

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
  Details modal pulls fragrance metadata into a rich ingredient card the
  table can't show, while a "View in monday" button still hands off to the
  native Item Card for first-party editing.
- **Resilient by design** — the frontend ships a bundled fragrance catalog
  it falls back to whenever the API is unreachable, so the Kanban never
  breaks even if the backend is down.

## Submission

Built per the take-home prompt provided February 2026. Presentation video
and walkthrough included separately.
