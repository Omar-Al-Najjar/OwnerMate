# DEPLOYMENT.md
# Put this file at: repository root

# Deployment Guide

## 1. Scope

This document covers deployment expectations for the current OwnerMate implementation.

It focuses on:
- FastAPI backend runtime deployment
- Alembic migration execution
- Docker-compatible backend packaging
- environment variable requirements

It does not add:
- forecasting infrastructure
- trend-analysis services
- non-Docker deployment-only architecture changes

## 2. Backend Deployment Summary

The backend is designed to run as a containerized FastAPI service.

Current backend deployment assumptions:
- the backend image is built from `backend/`
- Uvicorn serves `app.main:app`
- the backend requires `DATABASE_URL` for database-backed readiness
- Alembic migrations run as an explicit deployment step, not automatically on every app start
- privileged keys remain server-side only

## 3. Backend Environment Variables

### Runtime
- `APP_ENV`
- `DATABASE_URL`

### Auth / Platform
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Optional Runtime Tuning
- `API_V1_PREFIX`
- `UVICORN_HOST`
- `UVICORN_PORT`
- `PORT`
- `LOG_LEVEL`
- `DOCS_URL`
- `REDOC_URL`
- `OPENAPI_URL`

Routing note:
- if `API_V1_PREFIX` is set in a deployed environment, all backend routes are mounted under that prefix

### AI / Provider Settings
- `SENTIMENT_PROVIDER`
- `CONTENT_PROVIDER`
- `GOOGLE_REVIEW_PROVIDER`
- `FACEBOOK_REVIEW_PROVIDER`
- `REVIEW_INTELLIGENCE_PROVIDER`

Exact current runtime behavior:
- `DATABASE_URL` is the only environment variable required for DB-backed readiness
- `APP_ENV` and the runtime tuning variables have safe defaults
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are required for live bearer-token verification to succeed in production-shaped auth flows
- `SUPABASE_SERVICE_ROLE_KEY` is not required for startup, but remains the expected backend-only secret for future admin-side Supabase operations
- all provider settings currently only support `mock`

## 4. Current Auth Assumption

The current backend auth/session boundary is now Supabase-token-verified.

Current implementation status:
- protected backend routes require a bearer token
- the backend verifies Supabase user identity before resolving the local app user
- the local `users` and `businesses` tables are created or updated after verified identity mapping
- the old `X-User-Id` boundary is no longer the normal production path
- no backend CORS middleware is configured yet, so browser-based cross-origin deployments still need a same-origin proxy or an explicit backend CORS change

## 5. Docker Build

Backend image build context:
- `backend/`

Example build command:

```bash
docker build -t ownermate-backend ./backend
```

Current backend image contents:
- application code under `app/`
- Alembic config via `alembic.ini`
- migration scripts under `migrations/`
- deployment helper scripts under `scripts/`
- runtime dependencies from `backend/requirements.txt`

## 6. Docker Run

Example backend run command:

```bash
docker run --rm -p 8000:8000 \
  -e APP_ENV=production \
  -e DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname \
  -e SUPABASE_URL=https://project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=server-side-secret \
  ownermate-backend
```

Notes:
- the container listens on `0.0.0.0`
- the runtime command honors `PORT` when the deployment platform injects it
- the image exposes port `8000`
- the container includes a Docker `HEALTHCHECK` against `GET /health`

## 7. Health and Readiness

### `GET /health`
Use for liveness.

Current behavior:
- returns `200` when the FastAPI process is running
- includes backend environment and version metadata

### `GET /ready`
Use for readiness / traffic eligibility.

Current behavior:
- returns `200` only when required deployment checks pass
- returns `503` when required deployment checks fail
- checks whether `DATABASE_URL` is configured
- checks actual database connectivity with a lightweight connection probe
- reports the current backend auth boundary assumption
- confirms Alembic migration config files are present in the deployed image

## 8. Database Connectivity Assumption

The backend expects a Postgres-compatible connection string in `DATABASE_URL`.

Current expectation:
- SQLAlchemy uses `DATABASE_URL` for runtime database access
- Alembic also resolves migrations from `DATABASE_URL`
- readiness is not considered healthy until the backend can connect to the database

## 9. Migration Flow

Migrations should run as a separate deployment step before routing application traffic.

Recommended flow:
1. build backend image
2. inject deployment environment variables
3. run migrations as a one-off job
4. start or roll the backend app containers
5. use `GET /ready` before sending live traffic

Example migration command:

```bash
docker run --rm \
  -e DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname \
  ownermate-backend \
  python -m alembic -c alembic.ini upgrade head
```

Safety notes:
- `backend/alembic.ini` no longer contains a real fallback database URL
- deployments must provide `DATABASE_URL` explicitly
- the backend does not auto-run migrations on container boot, which avoids unsafe repeated startup-side schema changes

## 10. Disposable Smoke Stack

The repository now includes a disposable backend-only smoke stack for deployment rehearsal:

- `backend/.env.example`
- `backend/docker-compose.smoke.yml`
- `backend/scripts/seed_smoke_data.py`
- `backend/scripts/smoke_test.py`

Recommended local verification flow:
1. `cd backend`
2. `docker compose -f docker-compose.smoke.yml build backend`
3. `docker compose -f docker-compose.smoke.yml up -d db`
4. `docker compose -f docker-compose.smoke.yml run --rm backend python -m alembic -c alembic.ini upgrade head`
5. `docker compose -f docker-compose.smoke.yml up -d backend`
6. seed one owner user and business for auth-scoped smoke requests
7. run `python scripts/smoke_test.py` with `SMOKE_BASE_URL`, `SMOKE_USER_ID`, and `SMOKE_BUSINESS_ID`
8. `docker compose -f docker-compose.smoke.yml down -v`

## 11. Supabase-Hosted Data Runtime

The repository now also supports running the backend against Supabase-hosted Postgres instead of the disposable local `db` container.

Files:
- `backend/.env.supabase.example`
- `backend/docker-compose.supabase.yml`
- `backend/scripts/run_supabase_migrations.ps1`
- `SUPABASE_DATA_CUTOVER_PLAN.md`

Recommended hosted cutover flow:
1. copy `backend/.env.supabase.example` to `backend/.env.supabase`
2. fill in the real Supabase `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
3. run `powershell -ExecutionPolicy Bypass -File backend/scripts/run_supabase_migrations.ps1`
4. run `docker compose -f backend/docker-compose.supabase.yml up -d --build backend`
5. verify `GET /ready`

Smoke coverage currently verifies:
- `GET /health`
- `GET /ready`
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

## 12. Deployment Validation Checklist

- backend image builds successfully
- required env vars are present in the runtime environment
- `GET /health` returns `200`
- `GET /ready` returns `200` after env injection and DB availability
- `python -m alembic -c alembic.ini upgrade head` succeeds in the deployment environment
- core auth-, review-, sentiment-, and content-flow smoke tests succeed against a live backend instance
- privileged secrets are injected only into the backend runtime, never the client

For operator-facing rollout order, preflight checks, and rollback steps, use:
- `PRODUCTION_ROLLOUT_RUNBOOK.md`

## 13. Current Production Blockers

- no major auth blocker remains in the current app scope
- Supabase-hosted Postgres cutover is still pending if the goal is to unify auth and app data inside the same Supabase project
- no deployment-level proof was captured here for a real managed Postgres/Supabase database connection; current verification covers local/containerized Postgres-backed behavior
- no end-to-end release job or orchestrator manifest exists yet for automatically sequencing migration job then app rollout

## 13. Documentation Rule

Whenever deployment setup changes:
- update this file
- update `WORK_LOG.md`
- update `TECH_STACK.md` only if the approved stack changes
