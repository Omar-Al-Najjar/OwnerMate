# TECH_STACK.md
# Put this file at: repository root

# Tech Stack

## 1. Approved Technology Stack

This file locks the intended technologies for the current OwnerMate implementation.

Coding agents must stay within this stack unless a change is explicitly approved.

## 2. Backend

- FastAPI
- Uvicorn
- Supabase
- Alembic
- Pydantic

### Backend Expectations
- FastAPI is the primary backend web framework.
- Uvicorn runs the ASGI application.
- Pydantic is used for request, response, and settings validation.
- Alembic is used for schema migration management.
- Supabase provides database and authentication-related infrastructure where applicable.

## 3. Frontend

- Next.js
- shadcn/ui
- Tailwind CSS
- dark/light themes
- i18n

### Frontend Expectations
- Next.js is the main frontend framework.
- UI components should use shadcn/ui patterns where suitable.
- Tailwind CSS is the styling system.
- Theme support must handle dark and light modes cleanly.
- Internationalization must support Arabic and English from the start.

## 4. Infrastructure

- Docker containers

### Infrastructure Expectations
- local development should be container-friendly
- services should be able to run through Docker Compose
- deployment should remain compatible with containerized environments

## 5. Suggested Supporting Libraries

These are acceptable categories, not mandatory exact choices unless adopted by the repository:
- HTTP client libraries for backend external calls
- Supabase client libraries for frontend/backend integration
- state or data fetching utilities suitable for Next.js
- authentication helpers compatible with Supabase and Next.js
- testing libraries appropriate for FastAPI and Next.js

## 6. Do Not Introduce Without Approval

Coding agents should not introduce major alternative frameworks such as:
- Django
- NestJS
- Express as the main backend
- Streamlit as the main frontend
- separate forecasting or analytics platforms
- heavyweight BI dashboards as a replacement for the app

## 7. Scope Constraints Tied to the Stack

The stack must support:
- authentication
- review ingestion
- sentiment analysis
- AI content generation
- multi-agent orchestration
- bilingual UI
- responsive web pages

The stack must **not** be used to implement excluded features such as:
- trend analysis dashboards
- predictive forecasting modules
- time-series pipelines
- inventory prediction engines

## 8. Coding Standards

- prefer modular services over large monolith files
- prefer typed request and response models
- keep UI components reusable and theme-aware
- separate domain logic from transport logic
- keep environment-dependent configuration centralized

## 9. Documentation Standards

After each meaningful code change, the agent must update `WORK_LOG.md`.

If the change affects:
- API behavior -> update `API.md`
- architecture -> update `ARCHITECTURE.md`
- workflow/agents -> update `AGENTS.md`
- deployment/setup -> update `DEPLOYMENT.md`
- planned work -> update `TASKS.md`

## 10. Repository Hygiene Rule

Agents must avoid silent drift in technology choices.
If a library is added, the agent should document:
- why it was added
- where it is used
- whether it replaced an older dependency