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
- service layer for ingestion, sentiment analysis, and content generation
- orchestration layer for agent routing

### Data and Platform Services
- Supabase auth
- Supabase Postgres storage
- Alembic migrations for managed schema evolution

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
* auth provider validates session
* protected routes render only for authenticated users

### 4.2 Review Ingestion Flow
* user triggers review import or sync
* backend calls source-specific ingestion logic
* raw source data is normalized
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
    api/
    core/
    models/
    schemas/
    services/
    agents/
    repositories/
    migrations/
```

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
  * source
  * source_review_id
  * rating
  * language
  * reviewer_name
  * review_text
  * review_created_at
  * ingested_at
  * status

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
  * type
  * language
  * prompt_context
  * generated_text
  * edited_text (nullable)
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

## 11. Observability

Recommended minimum observability:
* request logging
* ingestion job logs
* agent run logs
* generation failure logs
* sentiment processing failure logs

## 12. Documentation Rule

Whenever architecture changes, the agent must:
* update this file
* update WORK_LOG.md
* note any related API or database impact
* turn into a single md file