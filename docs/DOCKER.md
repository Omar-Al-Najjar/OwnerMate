# Docker Run Guide

## Files

- Root compose file: `docker-compose.yml`
- Root env file: `.env`
- Service-specific env templates may exist under subprojects

## First-time setup

1. Change into the repository root, or use `-f` with an absolute path to `docker-compose.yml`.
2. Fill in the real Supabase and LLM credentials in the root `.env`.

## Run the full stack

```bash
docker compose up --build
```

From any directory, you can also run:

```bash
docker compose -f /path/to/OwnerMate/docker-compose.yml up --build
```

## Services

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Google Maps API: `http://localhost:8010`
- Dataset analysis API: `http://localhost:8020`
- Sentiment API: `http://localhost:8030`

## Notes

- The compose stack uses internal Docker DNS names between containers, so the services talk to each other through `backend`, `dataset-analysis`, `google-maps-api`, and `sentiment-api`.
- The backend is configured for Supabase via `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` from the root `.env`.
- If you do not want one of the AI services enabled, remove that service and the related environment variables from `docker-compose.yml`.
