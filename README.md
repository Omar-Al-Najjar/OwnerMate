# OwnerMate

OwnerMate is a bilingual AI-assisted business platform for small and medium-sized businesses, with a focus on Arabic and English review workflows for the Jordanian market.

The current implementation focuses on review ingestion, multilingual sentiment analysis, AI-assisted content generation, operational reporting, and structured task routing. Forecasting, trend analysis, and predictive inventory are intentionally outside the implemented scope and are treated as future work.

## Scope

OwnerMate includes:

- account authentication and role-aware access
- review ingestion from supported sources and uploaded files
- Arabic and English sentiment analysis
- review summaries and operational report support
- editable review replies and marketing copy
- orchestrated task routing for approved workflows
- responsive bilingual web UI with dark and light themes

OwnerMate does not include:

- demand forecasting
- time-series forecasting
- inventory prediction
- trend analysis
- forecast dashboards or forecast agents

## Repository

```text
.
├─ README.md
├─ docker-compose.yml
├─ .env.example
├─ frontend/
│  └─ frontend/              Next.js application
├─ backend/
│  └─ backend/               FastAPI application, migrations, tests
├─ AI-system/                AI support services and prototypes
├─ docs/                     Project documentation and work logs
└─ scripts/                  Local helper scripts
```

Main documentation now lives in `docs/`.

## Tech Stack

Backend:

- FastAPI
- SQLAlchemy and Alembic
- Pydantic
- Supabase Auth and Postgres
- Pytest

Frontend:

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Supabase client libraries
- Playwright

AI and services:

- sentiment API service
- Google Maps review import API
- dataset analysis service
- optional LLM provider integration

Infrastructure:

- Docker and Docker Compose

## Local Setup

Prerequisites:

- Node.js 20+
- Python 3.11+
- Docker and Docker Compose
- Supabase project credentials

First-time setup:

```bash
cp .env.example .env
```

Fill `.env` with real Supabase, database, and provider credentials.

Run the full stack:

```bash
docker compose up --build
```

Default local services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Google Maps API: `http://localhost:8010`
- Dataset analysis API: `http://localhost:8020`
- Sentiment API: `http://localhost:8030`

## Environment Variables

Important variables are listed in `.env.example`. The main groups are:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Database: `DATABASE_URL`, `DIRECT_URL`
- Backend/API: `BACKEND_API_BASE_URL`, `API_V1_PREFIX`, `UVICORN_HOST`, `UVICORN_PORT`
- Providers: `SENTIMENT_PROVIDER`, `CONTENT_PROVIDER`, `GOOGLE_REVIEW_PROVIDER`, `REVIEW_INTELLIGENCE_PROVIDER`
- LLM: `OWNERMATE_LLM_API_KEY`, `OWNERMATE_LLM_MODEL`, `OWNERMATE_LLM_BASE_URL`
- Service ports: `FRONTEND_HOST_PORT`, `BACKEND_HOST_PORT`, `GOOGLE_MAPS_API_HOST_PORT`, `DATASET_ANALYSIS_HOST_PORT`, `SENTIMENT_HOST_PORT`

Do not commit real secrets.

## Testing

Backend tests:

```bash
cd backend/backend
pytest
```

Frontend checks:

```bash
cd frontend/frontend
npm run lint
npm run build
npm run test:e2e
```

Some tests require valid environment variables or running services.

## Documentation Index

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/TASKS.md`
- `docs/API.md`
- `docs/AGENTS.md`
- `docs/DEPLOYMENT.md`
- `docs/DOCKER.md`
- `docs/DATABSE_SCHEMA.md`
- `docs/CODING_RULES.md`
- `docs/WORK_LOG.md`

Service-specific docs are under:

- `docs/backend/`
- `docs/frontend/`
- `docs/AI-system/`

## Documentation Discipline

After each meaningful change, update `docs/WORK_LOG.md`.

If a change affects architecture, API behavior, database schema, agent workflow, setup, deployment, or UI behavior, update the matching file under `docs/` in the same session.

## Implementation Rules

- Do not reintroduce forecasting, trend analysis, or predictive inventory as implemented features.
- Keep agent routing limited to approved review, sentiment, summary, and content workflows.
- Preserve business-scoped access controls.
- Keep generated content editable before use.
- Prefer small, testable changes with documented outcomes.
