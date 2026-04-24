# Kompass

Kompass tracks global stress, calm, and momentum through public news flow and
free market data.

The project started as a practical dashboard first and a polished repo second.
That is still the right way to read it: the important part is whether the live
signal is useful, fast, and explainable.

Right now Kompass surfaces:

- live or mocked feed status
- country-level tone and source coverage
- KGPI, the Kompass Global Pulse Index
- rolling market correlations and alerts

## License and use

Kompass is public to view, but it is not open source in the OSI sense.

- The public may access the official hosted Kompass experience for
  noncommercial informational use.
- The source is visible for transparency and private evaluation.
- Modification, redistribution, resale, derivative deployments, and
  organizational use require prior written permission from Daniel Garcia Rey.

See [LICENSE](./LICENSE) for the controlling terms.

## Stack

- Backend: Node.js 18+, Express, SQLite
- Frontend: React 18, Vite, Tailwind CSS, react-simple-maps
- Data: GDELT 2.0, Yahoo Finance chart endpoints, Alternative.me Fear and
  Greed
- Deploy: Docker, Fly.io

Nothing in the default stack requires a paid API.

## Fastest run

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\start_kompass.ps1
```

That launcher:

- builds the frontend
- starts the backend in production mode
- serves the app at `http://localhost:8080`
- opens the browser automatically

It exists because I got tired of juggling two terminals every time I wanted to
check whether a UI or ingestion tweak actually worked.

To stop it:

```powershell
powershell -ExecutionPolicy Bypass -File .\start_kompass.ps1 -Stop
```

Optional:

- `-NoBrowser` starts the app without opening a tab

## Manual dev mode

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
npm start
```

Then open:

- `http://localhost:5173`
- `http://localhost:8080/api/health`
- `http://localhost:8080/metrics`

If the frontend is up but the data still looks empty, give the backend a moment
to finish its first GDELT and finance pulls.

## What KGPI does

KGPI is the Kompass Global Pulse Index. It is a 0-100 composite mood score
built from:

- VIX
- VXN
- OVX
- MOVE
- crypto Fear and Greed
- realized short-term cross-asset volatility

Lower values mean fear or stress. Higher values mean greed or risk-on behavior.

It is not meant to be a magic truth number. It is just a compact way to keep
cross-asset pressure, news tone, and conflict intensity in one line of sight.

The frontend shows:

- feed status cards with pulsing live/mock state
- KGPI score and its component drivers
- per-country source counts and top source domains
- top event swings with deterministic explanations

## How GDELT is pulled

Kompass uses GDELT's free DOC API and fans out requests across multiple country
slices instead of one broad query.

Default slices:

- `US,GB,DE,FR,IN,JP,BR,ZA,AU,CA,MX,SG`

Important behavior:

- requests are rate-aware with a minimum gap between calls
- the backend keeps the last live GDELT snapshot for a while before dropping to
  mock mode
- if the article payload omits explicit tone values, Kompass computes
  deterministic headline-based tone and Goldstein fallbacks
- the app shows whether GDELT is `live`, `stale`, `live-partial`, or `mock`

This is intentionally a bit defensive. Free feeds wobble. Kompass tries hard
not to blank the whole dashboard just because one upstream endpoint had a bad
minute.

## Environment

Copy `.env.example` to `.env` if needed. The repo already includes a working
`.env`.

Important variables:

- `GDELT_API_URL`
- `GDELT_COUNTRY_SLICES`
- `GDELT_TIMESPAN`
- `GDELT_MAX_RECORDS`
- `GDELT_MIN_REQUEST_GAP`
- `GDELT_KEEP_LAST_LIVE`
- `FINANCE_PROVIDER`
- `POLL_INTERVAL_GDELT`
- `POLL_INTERVAL_FINANCE`
- `CACHE_TTL`
- `KGPI_BASELINE_POINTS`
- `VITE_API_BASE_URL`

Most of the time you only need to touch polling intervals, provider selection,
or a couple of feed toggles.

## Docker Compose

Run:

```powershell
docker-compose up
```

Notes:

- SQLite is embedded in the backend, not a standalone service
- `./data` persists `kompass.sqlite`
- a Postgres example remains commented in `docker-compose.yml` for later
  upgrade

For local work, SQLite is the point. Less ceremony, fewer moving parts, fewer
excuses.

## Fly.io

1. Launch:

```powershell
flyctl launch --name kompass-yourname
```

2. Deploy:

```powershell
flyctl deploy
```

3. Set secrets:

```powershell
flyctl secrets set GDELT_API_URL=https://api.gdeltproject.org/api/v2/doc/doc FINANCE_PROVIDER=yahoo
```

## Zero-cost guidance

- keep GDELT polling at 5 minutes or slower
- keep finance polling at 1 minute or slower
- increase `CACHE_TTL` if free providers start rate-limiting
- use the launcher and built-in fallback modes for demos
- leave `backend/services/llmAdapter.js` disabled unless you explicitly add a
  model later

If a provider starts behaving badly, resist the temptation to “fix” it by
spamming requests harder. Slow it down, cache more, and keep the last good
snapshot alive a bit longer.

## Health check

Expected:

- `GET /api/health` returns `ok: true`
- `ready` becomes `true` once the first finance and GDELT pulls finish
- `coverage.gdelt` shows how many slices succeeded and how many source domains
  are currently represented

If `ready` stays false for too long, check provider timeouts before you start
changing app code. In practice that is the usual culprit.

## Contribution policy

Kompass is curator-led. Public bug reports and factual corrections are welcome,
but code changes, forks for use, and derivative deployments require prior
written permission from Daniel Garcia Rey.

## First run checklist

- add keys or secrets if you later introduce optional providers
- run `npm install` in `backend` and `frontend` if dependencies are not already
  installed
- start with `powershell -ExecutionPolicy Bypass -File .\start_kompass.ps1`
- verify `http://localhost:8080/api/health`
- open `http://localhost:8080`
