# PRODUCTION_ROLLOUT_RUNBOOK.md

# Production Rollout Runbook

## Purpose

This runbook is the operator-facing checklist for deploying the current OwnerMate backend safely.

It is intentionally practical:
- what values must be collected
- what order to deploy in
- what to verify before live traffic
- when to stop or roll back

## Current Go / No-Go Status

### Current recommendation

- `NO-GO` for a true production release with real user traffic

### Why it is currently blocked

- backend protected routes still rely on the temporary `X-User-Id` header boundary
- real Supabase token or session verification is not implemented in the backend yet

### What is already validated

- Docker build works
- Alembic migrations run successfully
- backend readiness works against a live Postgres connection
- core HTTP flows work end to end against a live backend plus Postgres stack

### When this can become a `GO`

At minimum:
1. replace the temporary `X-User-Id` boundary with real backend session or token verification
2. validate managed production database connectivity with real environment secrets
3. rerun the smoke checklist below in the target environment

## Release Scope

This runbook covers:
- backend API service deployment
- environment configuration
- migration execution
- smoke validation
- rollback guidance

This runbook does not cover:
- forecasting or trend features
- frontend deployment details
- long-term observability stack design

## Required Production Inputs

Collect these values before starting the rollout.

### Runtime

- `APP_ENV=production`
- `DATABASE_URL`

### Auth / platform

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Route and runtime tuning

- `API_V1_PREFIX`
- `UVICORN_HOST`
- `UVICORN_PORT`
- `PORT`
- `LOG_LEVEL`
- `DOCS_URL`
- `REDOC_URL`
- `OPENAPI_URL`

### Provider settings

- `SENTIMENT_PROVIDER`
- `CONTENT_PROVIDER`
- `GOOGLE_REVIEW_PROVIDER`
- `FACEBOOK_REVIEW_PROVIDER`
- `REVIEW_INTELLIGENCE_PROVIDER`

### Required values for the current implementation

Right now the supported provider values are:
- `SENTIMENT_PROVIDER=mock`
- `CONTENT_PROVIDER=mock`
- `GOOGLE_REVIEW_PROVIDER=mock`
- `FACEBOOK_REVIEW_PROVIDER=mock`
- `REVIEW_INTELLIGENCE_PROVIDER=mock`

## Environment Collection Sheet

Use this section as the handoff worksheet for whoever owns secrets and infra.

| Key | Required | Example / Notes | Collected |
| --- | --- | --- | --- |
| `APP_ENV` | yes | `production` | |
| `DATABASE_URL` | yes | `postgresql+psycopg://...` | |
| `SUPABASE_URL` | yes | `https://project.supabase.co` | |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | backend secret only | |
| `API_V1_PREFIX` | optional | blank or `/api/v1` | |
| `UVICORN_HOST` | optional | usually `0.0.0.0` | |
| `UVICORN_PORT` | optional | usually `8000` | |
| `PORT` | platform-specific | many hosts inject this | |
| `LOG_LEVEL` | optional | `info` recommended | |
| `DOCS_URL` | optional | `/docs` or disabled | |
| `REDOC_URL` | optional | `/redoc` or disabled | |
| `OPENAPI_URL` | optional | `/openapi.json` or disabled | |
| `SENTIMENT_PROVIDER` | yes | currently `mock` only | |
| `CONTENT_PROVIDER` | yes | currently `mock` only | |
| `GOOGLE_REVIEW_PROVIDER` | yes | currently `mock` only | |
| `FACEBOOK_REVIEW_PROVIDER` | yes | currently `mock` only | |
| `REVIEW_INTELLIGENCE_PROVIDER` | yes | currently `mock` only | |

## Preflight Checklist

Do not begin rollout until all of these are true.

- production image build source is the current intended commit
- all required env vars are present
- `DATABASE_URL` is for the target environment, not local or staging
- migration job runtime can reach the target database
- backend runtime can reach the same target database
- rollback owner is identified
- maintenance window or rollout window is agreed if needed
- known auth blocker is acknowledged by stakeholders

## Build and Release Order

Recommended order:

1. build the backend image
2. inject production env vars into the migration job
3. run `alembic upgrade head`
4. inject the same runtime env vars into the backend service
5. start or roll the backend application
6. verify `GET /health`
7. verify `GET /ready`
8. run smoke checks
9. only then expose traffic

## Commands

### Build

```bash
docker build -t ownermate-backend ./backend
```

### Migrate

```bash
docker run --rm \
  -e APP_ENV=production \
  -e DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname \
  -e SUPABASE_URL=https://project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=server-side-secret \
  -e SENTIMENT_PROVIDER=mock \
  -e CONTENT_PROVIDER=mock \
  -e GOOGLE_REVIEW_PROVIDER=mock \
  -e FACEBOOK_REVIEW_PROVIDER=mock \
  -e REVIEW_INTELLIGENCE_PROVIDER=mock \
  ownermate-backend \
  python -m alembic -c alembic.ini upgrade head
```

### Run

```bash
docker run --rm -p 8000:8000 \
  -e APP_ENV=production \
  -e DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname \
  -e SUPABASE_URL=https://project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=server-side-secret \
  -e SENTIMENT_PROVIDER=mock \
  -e CONTENT_PROVIDER=mock \
  -e GOOGLE_REVIEW_PROVIDER=mock \
  -e FACEBOOK_REVIEW_PROVIDER=mock \
  -e REVIEW_INTELLIGENCE_PROVIDER=mock \
  ownermate-backend
```

## Smoke Tests

### Minimum smoke gates

These must pass before traffic is allowed:

- `GET /health` returns `200`
- `GET /ready` returns `200`
- migration job finished successfully
- backend can answer one authenticated request with a valid known user

### Core flow smoke checks

Run these against the live backend:

- `GET /auth/me`
- `POST /reviews/import`
- `GET /reviews`
- `GET /reviews/{review_id}`
- `PATCH /reviews/{review_id}/status`
- `POST /sentiment/analyze`
- `GET /sentiment/reviews/{review_id}`
- `POST /content/generate/reply`
- `POST /content/save`
- `GET /content/{content_id}`
- `POST /content/generate/marketing`

### Existing local smoke tooling

The repo already includes reusable local smoke tooling under:
- `backend/docker-compose.smoke.yml`
- `backend/scripts/seed_smoke_data.py`
- `backend/scripts/smoke_test.py`

For target-environment validation, adapt the same call sequence to:
- the real production base URL
- a real seeded test user
- a real seeded test business

## Auth-Specific Caution

This is the most important rollout caveat in the current backend.

The backend currently treats `X-User-Id` as the authenticated user boundary.

That means:
- the backend is not yet verifying Supabase access tokens
- a real production deployment would need compensating controls if exposed externally
- public traffic should not be enabled as though auth were complete

Recommended stance until auth is fixed:
- limit deployment to internal validation, staging, or tightly controlled access
- do not market this as production-ready auth

## Database Connectivity Checks

Before declaring success:

- confirm migration job reached the target database
- confirm backend readiness reports database connection as reachable
- confirm smoke-created data is visible through authenticated API calls
- confirm there are no obvious schema mismatch errors in runtime logs

## Rollback Triggers

Roll back or stop the rollout immediately if any of these happen:

- migration failure
- `GET /ready` stays `503`
- backend cannot connect to the target database
- authenticated requests fail for known seeded users
- core review, sentiment, or content smoke flows fail
- secrets are discovered to be missing or mis-scoped

## Rollback Actions

Minimum rollback plan:

1. stop sending traffic to the new backend
2. restore the last known good backend image or deployment
3. verify `GET /health` and `GET /ready` on the restored version
4. inspect whether the failed rollout applied partial migrations
5. only run schema downgrade actions if they are explicitly reviewed and safe

Important:
- do not improvise destructive rollback commands against the production database
- migration rollback should be treated as a deliberate DBA or release-owner decision

## Operator Signoff

Use this section during the real rollout.

| Item | Owner | Status |
| --- | --- | --- |
| env vars collected |  |  |
| image built |  |  |
| migrations applied |  |  |
| backend started |  |  |
| `/health` passed |  |  |
| `/ready` passed |  |  |
| auth smoke passed |  |  |
| review smoke passed |  |  |
| sentiment smoke passed |  |  |
| content smoke passed |  |  |
| traffic enabled |  |  |

## Post-Deploy Follow-Up

After rollout:

- capture the deployed image tag or revision
- capture the exact deployment timestamp
- record whether smoke tests passed
- record any deviations from this runbook in `WORK_LOG.md`
- prioritize the backend auth-boundary replacement as the next release gate
