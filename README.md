# README.md
# Put this file at: repository root

# OwnerMate

OwnerMate is an AI-powered business optimization platform for small and medium-sized businesses, with a strong focus on the Jordanian market and bilingual usage in Arabic and English.

This repository is the implementation-ready version of the project for coding agents and developers.

## Important Scope Decision

**Trend analysis and everything related to it are excluded from this implementation.**

That means the project does **not** include:
- trend analysis
- predictive analytics
- demand forecasting
- time-series forecasting
- inventory forecasting
- forecast dashboards
- forecast pages
- trend-based recommendations
- sales trend modeling
- predictive inventory logic

The platform scope is limited to:
- account authentication and role-based access
- review ingestion from supported sources
- bilingual sentiment analysis for reviews
- AI-assisted content generation
- multi-agent orchestration for routing and task execution
- responsive bilingual web experience

## Core Product Goals

OwnerMate helps business owners:
- collect customer reviews from external platforms
- understand customer sentiment in Arabic and English
- generate response and marketing content using AI
- use a guided AI workflow instead of disconnected tools

## Target Users

- restaurant owners
- cafe owners
- small retail business owners
- small marketing teams inside SMBs
- business managers who need quick insight from customer feedback

## Core Features

### 1. Authentication and Access
- secure sign in and sign up
- session management
- role-based access for business users and admins
- optional MFA if kept in final scope

### 2. Review Ingestion
- collect reviews from supported platforms such as Google and Facebook
- normalize review data into a common structure
- store source metadata, timestamps, rating, language, and review text

### 3. Sentiment Analysis
- classify reviews by sentiment
- support Arabic and English reviews
- provide business-facing sentiment summaries and labels
- surface negative reviews that need action
- provide confidence score or model confidence metadata where useful

### 4. AI Content Generation
- generate replies to customer reviews
- generate short marketing copy based on reviews and business context
- allow user editing before publishing or copying
- support Arabic and English output

### 5. Multi-Agent Orchestration
- route user intent to the correct system capability
- coordinate ingestion, sentiment analysis, and content generation flows
- keep responses structured and safe

### 6. Responsive Web Application
- modern responsive UI
- dark and light themes
- bilingual interface using i18n
- dashboard and workflow pages built for real usage on desktop and mobile web

## Documentation Discipline

Every coding session must leave the repository more understandable than before.

After **each meaningful change**, the agent must document what happened in a root-level markdown file named:

- `WORK_LOG.md`

Each entry should include:
- date and time
- task or issue worked on
- files changed
- what was implemented
- any migrations, env changes, or setup changes
- any bugs introduced, discovered, or fixed
- what still remains
- whether the work was tested, and how

If a task changes architecture, API behavior, database schema, agent workflow, or UI behavior, the related documentation file must also be updated in the same session.

## Final In-Scope Deliverables

- production-ready Next.js frontend
- FastAPI backend
- Supabase-backed persistence and auth integration
- Alembic-based schema migration workflow
- Pydantic request and response validation
- containerized local and deployment setup with Docker
- implementation documentation for coding agents

## Tech Stack

### Backend
- FastAPI
- Uvicorn
- Supabase
- Alembic
- Pydantic

### Frontend
- Next.js
- shadcn/ui
- Tailwind CSS
- dark/light themes
- i18n

### Infrastructure
- Docker containers

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker and Docker Compose
- Supabase project credentials

### Suggested startup flow
- docker compose up --build

### Required Environment Variables

At minimum, the project will likely need:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- DATABASE_URL
- API_BASE_URL
- OPENAI_API_KEY or equivalent LLM provider key if used
- APP_ENV

### Documentation Index
- PRD.md
- ARCHITECTURE.md
- TECH_STACK.md
- TASKS.md
- API.md
- AGENTS.md
- DEPLOYMENT.md
- DATABASE_SCHEMA.md
- CODING_RULES.md
- WORK_LOG.md

### Implementation Rules for Coding Agents

- Do not reintroduce removed features.
- Do not add trend analysis or forecasting under a different name.
- After each meaningful change, update WORK_LOG.md.
- If behavior changes, update the relevant markdown docs in the same session.
- Prefer small, testable commits with documented outcomes.

## Suggested Repository Layout

```text
frontend/
backend/
  app/
    main.py
    api/
    core/
    models/
    schemas/
    repositories/
    services/
    agents/
components/
lib/
services/
agents/
docs/
```

## Current Backend Foundation

The backend foundation now starts inside `backend/app` and is intentionally separated from AI execution details.

- `app/api/` holds thin FastAPI route handlers
- `app/core/` holds shared configuration and response helpers
- `app/services/` holds backend business logic
- `app/repositories/` is reserved for persistence boundaries
- `app/agents/` preserves the orchestration boundary without implementing model logic yet


