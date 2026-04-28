# Candle Gift Box Production Builder

A monday.com app that streamlines order intake and production tracking for a
corporate candle gift box business. Designers create gift-box orders in
seconds; production sees a Kanban board and drags work across stages without
leaving monday.

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
                    └────┬────────────────────────────────┬───┘
                         │                                │
            Board View tab                   native Item Card panel
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
   create_item /              │ (vite proxies in dev;
   change_simple_column_value │  deployed URL in prod)
   items_page                 │
   activity_logs              ▼
         │         ┌────────────────────────────┐
         │         │  backend/ (Express, monday-code)
         │         │  GET/POST/PATCH/DELETE /fragrances
         │         │  Storage (apps-sdk) → in-memory fallback
         ▼         └────────────────────────────┘
  Production Orders board (item rows)
```

## Getting started

### One-time setup

```bash
npm install -g @mondaycom/apps-cli
mapps init -t YOUR_PERSONAL_MONDAY_API_TOKEN
cd backend  && npm install
cd ../frontend && npm install
```

### Environment variables

Copy from [`.env.example`](.env.example) into `backend/.env` and `frontend/.env`:

```bash
# backend/.env
PORT=8080
MONDAY_TOKEN=           # optional — omit for in-memory storage

# frontend/.env
VITE_FRAGRANCE_API_URL=http://localhost:8080
VITE_DEV_BOARD_ID=      # optional — used outside the monday iframe
VITE_DEV_API_TOKEN=     # optional — used outside the monday iframe
```

### Run locally

```bash
# Terminal 1 — backend
cd backend && npm start

# Terminal 2 — frontend
cd frontend && npm run server

# Terminal 3 — HTTPS tunnel for monday's iframe
cd frontend && npx mapps tunnel:create -p 8301
```

Point the board view feature in Developer Center at the tunnel URL, install
the app, and add a tab to the Production Orders board.

### Deploy

```bash
cd frontend && npm run deploy   # vite build → monday CDN
cd ../backend && npm run deploy # mapps code:push → monday-code
```

For production, set `VITE_FRAGRANCE_API_URL` in `frontend/.env.production.local`
to your deployed backend URL before building.

### OAuth scopes (deployed installs)

In Developer Center → **Build → OAuth & Permissions**:

- `boards:read`
- `boards:write`
- `me:read`

## Future improvements

- **Generalize beyond candle production** Make the board view
  configurable for other manufacturing and fulfillment workflows.

- **Custom intake form builder** Let admins define their own order
  fields without code changes.

- **Inventory management UI** A CRUD interface for managing raw
  materials and stock levels alongside the fragrance catalog.

- **Shipping integration** Connect to UPS / FedEx APIs to auto-track
  shipments and surface delivery status on the board.
