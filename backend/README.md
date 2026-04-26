# Candle backend (fragrance API)

Tiny Express service that powers the **fragrance catalog** required by the
take-home prompt. State is stored in monday.com's built-in
`@mondaycom/apps-sdk` Storage — no database to provision.

## Endpoints

| Method | Path                | Description                |
| ------ | ------------------- | -------------------------- |
| GET    | `/health`           | Liveness probe             |
| GET    | `/fragrances`       | List all fragrances        |
| GET    | `/fragrances/:id`   | Fetch a single fragrance   |
| POST   | `/fragrances`       | Create a fragrance         |
| PATCH  | `/fragrances/:id`   | Partially update           |
| DELETE | `/fragrances/:id`   | Remove                     |

A fragrance is shaped like:

```json
{
  "id": "fr_amber-noir",
  "name": "Amber Noir",
  "description": "Smoked amber, leather, and a whisper of vanilla bean.",
  "category": "Woody",
  "image_url": "https://...",
  "created_at": "2026-04-25T20:00:00Z",
  "updated_at": "2026-04-25T20:00:00Z"
}
```

## Local dev

```sh
cd backend
cp .env.example .env       # fill in MONDAY_TOKEN with a personal token
npm install
npm run dev                # node --watch src/server.js, port 8080
```

The server seeds 10 starter fragrances on first boot (idempotent — re-runs are
no-ops).

## Deploy to monday-code

```sh
cd backend
mapps code:push
```

The `MONDAY_TOKEN` env var is injected by monday-code automatically — no need
to commit a token. Update the frontend's `VITE_FRAGRANCE_API_URL` to the
deployed URL.
