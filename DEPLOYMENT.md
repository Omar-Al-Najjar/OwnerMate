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

## 3. Required Backend Environment Variables

### Runtime
- `APP_ENV`
- `DATABASE_URL`

### Auth / Platform
- `SUPABASE_URL`
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

### AI / Provider Settings
- `SENTIMENT_PROVIDER`
- `CONTENT_PROVIDER`
- `GOOGLE_REVIEW_PROVIDER`
- `FACEBOOK_REVIEW_PROVIDER`
- `REVIEW_INTELLIGENCE_PROVIDER`

## 4. Current Auth Assumption

The current backend auth/session boundary is not yet fully Supabase-token-verified.

Current implementation status:
- protected backend routes require an authenticated backend user
- the current backend request boundary still uses `X-User-Id`
- readiness reports this explicitly through the `auth_boundary` check
- this is acceptable for scaffold/dev deployment validation, but it remains a production blocker until real session verification is wired in

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

## 10. Deployment Validation Checklist

- backend image builds successfully
- required env vars are present in the runtime environment
- `GET /health` returns `200`
- `GET /ready` returns `200` after env injection and DB availability
- `python -m alembic -c alembic.ini upgrade head` succeeds in the deployment environment
- privileged secrets are injected only into the backend runtime, never the client

## 11. Current Production Blockers

- real Supabase-backed session verification is not implemented yet; auth still relies on the temporary `X-User-Id` backend boundary
- no deployment-level proof was captured here for a real managed Postgres/Supabase database connection, only local/containerized readiness behavior
- no end-to-end release job or orchestrator manifest exists yet for automatically sequencing migration job then app rollout

## 12. Documentation Rule

Whenever deployment setup changes:
- update this file
- update `WORK_LOG.md`
- update `TECH_STACK.md` only if the approved stack changes
