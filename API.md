# API.md
> **Note:** Put this file at the repository root.

# API Draft

## 1. API Scope

This document defines the intended backend API surface for the current OwnerMate implementation.

It covers:
- auth-aware application endpoints
- review ingestion and retrieval
- sentiment analysis
- content generation
- multi-agent execution

It explicitly excludes:
- trend analysis endpoints
- forecast endpoints
- predictive analytics endpoints

## 2. API Style

- REST-style JSON API
- validated with Pydantic schemas
- structured error responses
- auth required for protected operations

## 3. Suggested Route Groups

### Health
- `GET /health`
- `GET /ready`

### Auth / Session
- `GET /auth/me`
- `POST /auth/logout`

### Reviews
- `GET /reviews`
- `GET /reviews/{review_id}`
- `POST /reviews/import`
- `POST /reviews/import/google`
- `GET /reviews/import/google/{run_id}`
- `POST /reviews/import/google/{run_id}/selection`
- `POST /reviews/import/facebook`
- `PATCH /reviews/{review_id}/status`

### Sentiment
- `POST /sentiment/analyze`
- `POST /sentiment/analyze-batch`
- `GET /sentiment/reviews/{review_id}`

### Content Generation
- `POST /content/generate/reply`
- `POST /content/generate/marketing`
- `POST /content/regenerate`
- `POST /content/save`
- `GET /content/{content_id}`

### Agents
- `POST /agents/route`
- `POST /agents/run`
- `GET /agents/runs/{run_id}`

`GET /agents/runs/{run_id}` is now business-scoped and no longer returns `initiated_by_user_id`.

### Settings / User Preferences
- `GET /settings`
- `PATCH /settings/theme`
- `PATCH /settings/language`

## 4. Example Schemas

### Review Import Request
```json
{
  "business_id": "uuid",
  "source": "google",
  "source_config": {
    "business_name": "required",
    "location_id": "optional"
  }
}
```
For Google review import, `business_name` should be supplied. The current flow does not rely on a Google Maps URL.
The current Google import path is async: the backend creates a provider job,
polls provider status, and may require place selection before downloading
reviews. The downstream `google-maps-api` service resolves the raw Google place
token from the matched place link because `query_place_id` values alone are not
always valid for review download.

### Review Response
```json
{
  "id": "uuid",
  "source": "google",
  "rating": 4,
  "language": "en",
  "review_text": "Great service",
  "status": "pending",
  "review_created_at": "2026-03-17T10:00:00Z"
}
```

### Sentiment Analyze Request
```json
{
  "review_id": "uuid",
  "language_hint": "ar"
}
```

### Sentiment Result
```json
{
  "review_id": "uuid",
  "label": "negative",
  "confidence": 0.93,
  "summary_tags": ["slow service", "late order"]
}
```

### Generate Reply Request
```json
{
  "review_id": "uuid",
  "language": "ar",
  "tone": "professional",
  "business_context": "local coffee shop"
}
```

### Generate Reply Response
```json
{
  "content_id": "uuid",
  "type": "review_reply",
  "language": "ar",
  "generated_text": "..."
}
```

### Agent Route Request
```json
{
  "business_id": "uuid",
  "task": "generate_reply",
  "payload": {
    "review_id": "uuid"
  }
}
```

## 5. Response Conventions

### Success Shape
```json
{
  "success": true,
  "data": {}
}
```

### Error Shape
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload"
  }
}
```

## 6. Permissions Guidance
* Users should only access their own business data unless explicitly authorized.
* Admin-level routes should be clearly separated if they exist.
* Generated content and review data should be scoped by business ownership.

## 7. Data Integrity Guidance
* Import endpoints should support idempotency or deduplication logic.
* Analysis endpoints should not create duplicate rows unnecessarily.
* Content generation should preserve prompt context and creation metadata.

## 8. Excluded Endpoints
Do not add endpoints such as:
* `POST /forecast/*`
* `GET /trends/*`
* `POST /predict/*`
* `GET /analytics/forecast`

## 9. Documentation Rule
When an endpoint is added, removed, or behavior changes, the agent must:
* Update this file (`API.md`).
* Record the change in `WORK_LOG.md`.
* Note whether frontend consumers were updated too.

## 10. Current Prototype Contract

The repository currently includes a frontend handoff prototype in `Agent prototype/`.
This prototype is not yet the final OwnerMate review workflow. It is a dataset-analysis contract intended to help a frontend engineer integrate the current AI orchestration safely.

### Prototype analysis service routes

- `GET /health`
- `POST /jobs`
- `GET /jobs/{job_id}`

`GET /jobs/{job_id}` now also accepts an optional `locale` query parameter:
- `locale=en`
- `locale=ar`

### Website proxy routes

- `POST /api/dataset-analysis/jobs`
- `GET /api/dataset-analysis/jobs/{jobId}`

`GET /api/dataset-analysis/jobs/{jobId}` also accepts the same optional `locale` query parameter and forwards it to the prototype service.

`POST /api/dataset-analysis/jobs` now requires a `datasetName` form field between 3 and 25 characters before a job can be created.

### Prototype input

Multipart upload containing:
- one CSV file
- required `dataset_name`
- optional `source_name`
- optional `owner_user_id`
- optional `business_id`

### Prototype response shape

```json
{
  "task_type": "analyze_dataset",
  "status": "success",
  "data": {
    "dataset": {},
    "semantic_model": {},
    "questions": {},
    "findings": {},
    "insights": {},
    "run": {}
  },
  "meta": {
    "agent": "dataset_analysis_orchestrator",
    "duration_ms": 1234,
    "model": "kimi-k2.5",
    "question_count": 18,
    "successful_queries": 16,
    "failed_queries": 2
  },
  "error": null
}
```

### Prototype status values

- `success`
- `partial_success`
- `error`

### Prototype job status values

- `queued`
- `running`
- `success`
- `error`

### Prototype error shape

```json
{
  "code": "VALIDATION_ERROR",
  "message": "The uploaded CSV is empty.",
  "details": null
}
```

### Prototype note

This contract is suitable for the current Streamlit shell and for a future frontend port.
It should not be confused with the final in-scope OwnerMate APIs for review ingestion, sentiment analysis, and content generation.

The main OwnerMate backend remains untouched for this flow. The website proxies requests to the separate prototype service so long CSV analyses do not slow down the core application server.

Completed dataset-analysis jobs may now return locale-specific localized `result` content for Arabic UI consumers without changing the envelope shape or rerunning the analysis job.
The website also treats the user-provided dataset name as the canonical display name across overview and semantic-model result cards.
