# Supabase Data Cutover Plan

This document covers the next infrastructure step after the production blocker work: moving OwnerMate application data from the local Docker Postgres database to the Supabase Postgres database that belongs to the same Supabase project already used for authentication.

Current state on April 3, 2026:

- Supabase auth is live for sign-in, sign-up, session sync, and backend bearer-token verification
- application data is still stored in the local backend Postgres runtime defined in `backend/docker-compose.smoke.yml`
- that means Supabase Dashboard shows auth users, but not the app's `users`, `businesses`, `reviews`, `sales_records`, or related tables yet

## Goal

Unify auth and app persistence into one hosted Supabase project so:

- auth and app data live in one place
- the Supabase dashboard reflects the real app tables
- local-only Docker Postgres is no longer the production-shaped source of truth
- migrations run against the hosted database cleanly

## Recommended Approach

Use Supabase Postgres as the primary runtime database and keep the local Docker Postgres stack only as a disposable dev/smoke fallback.

## Preconditions

Before the final cutover, we need:

- Supabase project URL
- Supabase anon key
- Supabase service role key
- Supabase Postgres connection string with SSL enabled

Recommended database URL shape:

```text
postgresql+psycopg://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
```

Supabase may also provide a direct connection string on port `5432`. The pooled connection string is usually the safer default for app runtime, while either pooled or direct can be used for migrations if connectivity works from the local machine.

## Execution Plan

### Phase 1: Repo Preparation

- add a dedicated backend env example for Supabase-hosted data
- add a backend compose file that runs without the local `db` container
- add a helper command or script for running Alembic against Supabase Postgres
- document the exact cutover flow and rollback path

Status:
- completed in repo on April 3, 2026

### Phase 2: Hosted Database Provisioning

- copy the Supabase Postgres connection string from the Supabase dashboard
- create `backend/.env.supabase` from `backend/.env.supabase.example`
- fill in `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`

Status:
- pending user-provided database connection string

### Phase 3: Schema Cutover

- run `alembic upgrade head` against Supabase Postgres
- verify the hosted database now contains the OwnerMate schema
- confirm `GET /ready` passes while the backend points at Supabase Postgres

Success criteria:

- hosted database contains the Alembic version table
- hosted database contains app tables such as `users`, `businesses`, `reviews`, and `sales_records`
- backend readiness remains green

### Phase 4: Runtime Cutover

- run the backend with `backend/docker-compose.supabase.yml`
- verify sign-in, `/auth/me`, dashboard, reviews, settings, and sales flows
- verify new user creation writes to Supabase Postgres tables

Success criteria:

- Supabase-authenticated users create or update rows in the hosted `users` table
- dashboard and settings flows read and write hosted data successfully
- the Supabase table editor shows the app tables and live records

### Phase 5: Data Backfill

Choose one of these:

- re-seed minimal demo or onboarding data into Supabase Postgres
- export and import selected local data from Docker Postgres into Supabase Postgres

Recommended first move:

- migrate only the real business data we care about now
- avoid copying old demo-only rows unless they are still useful

### Phase 6: Rollback Plan

If hosted cutover fails:

- switch `DATABASE_URL` back to the local Docker Postgres URL
- run the backend again with `backend/docker-compose.smoke.yml`
- keep Supabase auth enabled while data continues to use the local fallback temporarily

## Exact Commands

### 1. Create backend env file

```powershell
Copy-Item backend/.env.supabase.example backend/.env.supabase
```

### 2. Fill in hosted database credentials

Required variables in `backend/.env.supabase`:

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Run migrations against Supabase Postgres

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/run_supabase_migrations.ps1
```

### 4. Start backend against Supabase Postgres

```powershell
docker compose -f backend/docker-compose.supabase.yml up -d --build backend
```

### 5. Verify readiness

```powershell
Invoke-WebRequest http://127.0.0.1:8000/ready
```

## Validation Checklist

- `GET /health` returns `200`
- `GET /ready` returns `200`
- sign-in works
- `/auth/me` returns the authenticated user
- dashboard data loads
- settings save works
- a new sales record appears in the Supabase table editor

## What Is Already Executed

Completed in this repo:

- created the cutover plan
- added a Supabase-hosted backend compose file
- added a dedicated Supabase backend env example
- added a migration helper script for Supabase Postgres that prefers `DIRECT_URL` when present
- updated docs so the hosted data path is explicit

Not yet executable without one more secret:

- the real Supabase Postgres `DATABASE_URL`

## Remaining User Input

To finish the cutover, provide the Supabase Postgres connection string from:

- Supabase Dashboard
- `Project Settings`
- `Database`
- `Connection string`

Use the SQLAlchemy-friendly form with `postgresql+psycopg://...` and `?sslmode=require`.
