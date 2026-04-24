# Deployment

## Docker Compose

Run locally:

```bash
docker-compose up
```

This starts:

- backend on `:8080`
- frontend on `:5173`

SQLite is embedded in the backend and persists to `./data/kompass.sqlite`.

That setup is intentionally boring. For local and single-operator use, boring
is good.

## Docker image

The root `Dockerfile` builds the frontend first, then copies the production frontend bundle into the backend image. In production, the Express server serves the built frontend.

One container is enough here. Splitting it earlier just adds surface area
without buying much.

## Fly.io

For a public always-on deployment with the current SQLite setup, use a single Fly Machine with a persistent volume.

1. Login:

```bash
fly auth login
```

2. Launch:

```bash
flyctl launch --name kompass-yourname
```

3. Create the persistent volume for SQLite:

```bash
fly volumes create kompass_data --size 3 --region ams -a kompass-yourname
```

4. Deploy:

```bash
flyctl deploy
```

5. Set secrets:

```bash
flyctl secrets set GDELT_API_URL=... FINANCE_PROVIDER=yahoo ALERT_WEBHOOK_SECRET=...
```

6. Validate:

- `GET /api/health`
- `GET /metrics`
- `https://kompass-yourname.fly.dev`

7. Optional custom domain:

```bash
fly certs add yourdomain.com
```

Then follow the DNS instructions Fly prints.

## Operational notes

- Increase `CACHE_TTL` before increasing polling frequency.
- Keep `POLL_INTERVAL_GDELT` conservative to avoid unnecessary traffic.
- SQLite on Fly is fine for a single-machine MVP, but it is not true high availability. If you want real failover across regions, move persistence to Postgres and run more than one Machine.
- Watch logs for provider fallback events.
- If Yahoo Finance becomes unstable, keep the mock fallback enabled until a replacement free source is wired in.

Also: if the machine starts feeling tight on RAM, fix fetch fan-out and cache
shape first. Throwing memory at bad request patterns only buys time.

## Recovery basics

- Redeploy the last known-good image if a release breaks fetch paths.
- Keep the `data/` directory backed up if the SQLite file becomes important.
- If the local DB becomes corrupt during development, stop the stack and remove `data/kompass.sqlite`.

The recovery path should stay simple enough to run while tired. If it needs a
runbook the size of a novella, the setup is too complicated.
