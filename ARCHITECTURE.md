# ARCHITECTURE.md
> **Note:** Put this file at the repository root.

# Architecture

## 1. Architecture Summary

OwnerMate uses a web-first architecture with a Next.js frontend, a FastAPI backend, Supabase-backed data/auth services, and a multi-agent orchestration layer that routes review-related AI tasks.

This architecture deliberately excludes forecasting and trend-analysis services.

## 2. High-Level Components

### Frontend
- Next.js application
- shadcn/ui components
- Tailwind CSS styling
- i18n for Arabic and English
- dark/light theme support

### Backend API
- FastAPI application
- Uvicorn server
- Pydantic schemas for validation
- centralized Pydantic settings for backend configuration
- structured success and error response helpers
- service layer for ingestion, sentiment analysis, and content generation
- provider abstraction layer for AI integration boundaries
- orchestration layer for agent routing

### Data and Platform Services
- Supabase-backed auth is planned, but the current backend request boundary still uses `X-User-Id`
- Supabase Postgres storage
- Alembic migrations for managed schema evolution
- SQLAlchemy ORM models for backend persistence boundaries

### AI and Workflow Layer
- intent recognition and routing
- sentiment analysis pipeline
- content generation pipeline
- review ingestion coordination

## 3. Logical Architecture

```text
User
  -> Next.js Frontend
      -> FastAPI Backend
          -> Auth Layer
          -> Review Ingestion Services
          -> Sentiment Analysis Services
          -> Content Generation Services
          -> Agent Orchestrator
          -> Supabase/Postgres
```

## 4. Main Flows

### 4.1 Authentication Flow
* user opens the frontend
* frontend requests auth state
* current backend scaffold resolves the authenticated user from the `X-User-Id` request header
* backend loads the stored user record and applies business-scoped authorization checks
* protected routes render only for authenticated users

Current implementation note:
- real Supabase token/session verification is not wired into the backend yet
- the `X-User-Id` boundary is acceptable for scaffold/dev work only and remains a production blocker

### 4.2 Review Ingestion Flow
* user triggers review import or sync
* uploaded review files are parsed by format-specific preprocessing when the request comes from file upload
* uploaded rows are converted into an internal canonical CSV stage before shared import validation runs
* backend calls source-specific ingestion logic for provider-backed imports
* raw source data is normalized into the shared review schema
* validated review records are stored
* ingestion status is returned to frontend

### 4.3 Sentiment Analysis Flow
* frontend requests analysis for one review or a batch
* backend validates request via Pydantic schemas
* sentiment service processes the text
* results are saved and returned

### 4.4 Content Generation Flow
* user opens a review or generation screen
* user selects content type and language
* backend assembles prompt context
* generation service returns editable content
* user edits, copies, or saves the result

### 4.5 Agent Orchestration Flow
* user intent enters from structured action or text-like instruction
* orchestrator classifies the request
* orchestrator calls the appropriate specialized service
* frontend receives typed output payload

## 5. Recommended Backend Modules

```text
backend/
  app/
    main.py
    api/
    core/
    models/
    schemas/
    services/
    agents/
    repositories/
    migrations/
```

## 5.1 Current Backend Foundation Boundary

The current backend foundation keeps infrastructure and orchestration boundaries in place before feature-specific business logic is implemented.

- `app/main.py` creates the FastAPI app and registers shared exception handling
- `app/api/` exposes health, auth, review, sentiment, content, settings, and agent endpoints with thin handlers
- `app/core/` owns runtime settings and API response helpers
- `app/core/db.py` owns shared engine and session-factory creation for persistence
- `app/services/` contains health/readiness checks and will remain the home for backend workflows
- `app/services/review.py` now owns normalization, deduplication, and persistence orchestration for review APIs
- `app/services/review_upload.py` now preprocesses supported uploaded file formats into an internal canonical CSV stage before delegating to shared review ingestion
- `app/services/source_review_import.py` now keeps Google/Facebook source-fetch boundaries separate from the shared review persistence flow
- `app/services/review_summary.py` now provides grounded review-intelligence summaries from stored reviews and stored sentiment results without introducing trend or forecasting behavior
- `app/services/sentiment.py` and `app/services/content.py` now persist AI outputs through provider-agnostic service abstractions
- `app/services/providers/` contains provider interfaces and mock/dev implementations for AI-backed capabilities and source-specific review ingestion stubs
- uploaded file preprocessing stays behind the backend service boundary; agents and downstream services still receive typed review-import payloads rather than raw files
- `app/models/` now defines the SQLAlchemy persistence schema for core backend entities
- `app/repositories/` now contains review/business persistence access plus AI output and agent run persistence helpers
- `app/agents/orchestrator.py` now validates supported agent tasks and delegates execution to specialized services
- `app/api/routes/agents.py` exposes orchestration endpoints as backend wrappers rather than embedding workflow logic in routes
- `migrations/` and `alembic.ini` manage versioned database schema changes
- `app/agents/` contains orchestration scaffolding only and does not implement model execution yet

## 6. Recommended Frontend Modules

```text
frontend/
  app/
  components/
  features/
  lib/
  hooks/
  messages/
```

## 7. Core Domain Entities

* **User**
  * id
  * email
  * role
  * language_preference
  * theme_preference
  * created_at

* **Business**
  * id
  * name
  * owner_user_id
  * locale
  * created_at

* **Review**
  * id
  * business_id
  * review_source_id (nullable)
  * source_type
  * source_review_id
  * rating
  * language
  * reviewer_name
  * review_text
  * source_metadata
  * review_created_at
  * ingested_at
  * status
  * response_status

* **SentimentResult**
  * id
  * review_id
  * label
  * confidence
  * summary_tags
  * processed_at

* **GeneratedContent**
  * id
  * business_id
  * review_id (nullable)
  * content_type
  * language
  * tone
  * prompt_context
  * generated_text
  * edited_text (nullable)
  * created_by_user_id (nullable)
  * created_at

* **AgentRun**
  * id
  * business_id
  * agent_name
  * task_type
  * input_reference
  * output_reference
  * status
  * started_at
  * finished_at

## 8. Key Architectural Rules

* Frontend must not call protected data sources directly with privileged secrets.
* Validation must happen at API boundaries using Pydantic.
* Database schema changes must be versioned with Alembic.
* Agent orchestration must call explicit services rather than mixing logic inside controllers.
* Trend analysis and forecasting services must not exist in the implementation.

## 9. Excluded Components

Do not create these architecture components in this phase:
* forecasting service
* trend analysis engine
* time-series training service
* inventory optimization service
* forecast result storage tables
* predictive dashboard widgets

## 10. Error Handling

* use structured API error responses
* return validation errors with actionable messages
* isolate external ingestion failures so they do not crash the whole app
* log agent failures with enough metadata for debugging
* keep health and readiness checks separate from AI execution logic

## 11. Observability

Recommended minimum observability:
* request logging
* ingestion job logs
* agent run logs
* generation failure logs
* sentiment processing failure logs

Current implementation note:
- persisted `agent_runs` now provide the main implemented traceability path for ingestion, sentiment, content, and review-summary executions
- generalized request logging middleware is not implemented yet

## 12. Documentation Rule

Whenever architecture changes, the agent must:
* update this file
* update WORK_LOG.md
* note any related API or database impact
* turn into a single md file
