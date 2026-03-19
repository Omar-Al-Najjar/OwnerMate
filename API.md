# API.md
> **Note:** Put this file at the repository root.

# OwnerMate Backend API

## 1. Scope

This document describes the current implemented backend API surface.

Included:
- auth-aware backend endpoints
- review ingestion and retrieval
- sentiment analysis
- content generation
- orchestrated agent routing and execution

Excluded:
- trend analysis endpoints
- forecasting endpoints
- predictive analytics endpoints

## 2. Runtime Shape

- FastAPI JSON API
- default local base URL: `http://localhost:8000`
- routes are mounted under `API_V1_PREFIX`
- current default `API_V1_PREFIX` is empty, so local routes are mounted directly at `/...`
- success responses use the envelope `{ "success": true, "data": ... }`
- errors use the envelope `{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }`
- validation failures return `422 VALIDATION_ERROR`

Current backend auth boundary:
- all protected routes require `X-User-Id: <user-uuid>`
- the backend validates that the header is a UUID and that the user exists
- this is a temporary backend auth boundary; token or session verification is not implemented yet

Current frontend integration limitation:
- no CORS middleware is configured in `backend/app/main.py`
- browser clients need same-origin delivery, a frontend proxy, or a backend CORS change before cross-origin calls will work

## 3. Public Routes

### Health

- `GET /health`
- `GET /ready`

`GET /health`:
- always returns `200` when the process is alive
- returns backend service name, environment, and version

`GET /ready`:
- returns `200` when required readiness checks pass
- returns `503` when required readiness checks fail
- required checks are currently:
- `database_url`
- `database_connection`
- `auth_boundary`
- `migration_config`
- non-required informational checks are currently:
- `supabase_url`
- `supabase_service_role_key`

Implemented health success example:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "backend",
    "environment": "development",
    "version": "0.1.0"
  }
}
```

Implemented readiness success example:

```json
{
  "success": true,
  "data": {
    "status": "ready",
    "service": "backend",
    "environment": "production",
    "version": "0.1.0",
    "checks": [
      {
        "name": "database_url",
        "status": "configured",
        "required": true,
        "configured": true,
        "details": null
      }
    ]
  }
}
```

## 4. Protected Routes

### Auth

- `GET /auth/me`
- `POST /auth/logout`

`GET /auth/me`:
- requires `X-User-Id`
- returns the authenticated user plus businesses owned by that user

`POST /auth/logout`:
- requires `X-User-Id`
- returns a signed-out payload
- clears `sb-access-token`, `sb-refresh-token`, `access_token`, and `refresh_token` cookies on the response

Session example:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "owner@example.com",
      "full_name": "Owner User",
      "role": "owner",
      "language_preference": "en",
      "theme_preference": "dark"
    },
    "businesses": [
      {
        "id": "uuid",
        "name": "Cafe Amal",
        "owner_user_id": "uuid",
        "default_language": "en"
      }
    ],
    "authenticated_at": "2026-03-19T09:25:00Z"
  }
}
```

### Reviews

- `GET /reviews`
- `GET /reviews/{review_id}`
- `POST /reviews/import`
- `POST /reviews/import/google`
- `POST /reviews/import/facebook`
- `PATCH /reviews/{review_id}/status`

All review routes:
- require `X-User-Id`
- enforce business ownership or admin access before reading or mutating data

`GET /reviews` query parameters:
- required: `business_id`
- optional: `review_source_id`, `source_type`, `status`, `language`, `min_rating`, `max_rating`, `reviewer_name`, `search_text`, `created_from`, `created_to`, `limit`, `offset`

Normalization:
- `source_type`, `language`, `reviewer_name`, and `search_text` are trimmed and lowercased
- `limit` defaults to `50` and maxes at `100`
- `offset` defaults to `0`

`GET /reviews/{review_id}`:
- requires query parameter `business_id`

`POST /reviews/import`:
- accepts `business_id`, optional `review_source_id`, `source`, and `reviews`
- deduplicates repeated `source_review_id` values inside the payload as `duplicate_in_payload`
- rejects already imported rows as `already_imported`
- persists only new reviews
- duplicate-conflict database failures return `409 REVIEW_IMPORT_CONFLICT`

`POST /reviews/import/google` and `POST /reviews/import/facebook`:
- accept source-specific fetch payloads
- normalize provider results into the shared review import path
- are currently backed by mock providers only

`PATCH /reviews/{review_id}/status`:
- requires query parameter `business_id`
- only updates the stored review workflow `status`

Review object shape:

```json
{
  "id": "uuid",
  "business_id": "uuid",
  "review_source_id": "uuid",
  "source_type": "google",
  "source_review_id": "external-review-id",
  "reviewer_name": "Jane Doe",
  "rating": 5,
  "language": "en",
  "review_text": "Great service",
  "source_metadata": {
    "provider": "mock",
    "location_id": "abc123"
  },
  "review_created_at": "2026-03-17T10:00:00Z",
  "ingested_at": "2026-03-19T05:44:00Z",
  "status": "pending",
  "response_status": null,
  "created_at": "2026-03-19T05:44:00Z",
  "updated_at": "2026-03-19T05:44:00Z"
}
```

Review import response example:

```json
{
  "success": true,
  "data": {
    "source": "google",
    "business_id": "uuid",
    "review_source_id": "uuid",
    "requested_count": 2,
    "imported_count": 1,
    "duplicate_count": 1,
    "processed_count": 2,
    "imported_reviews": [],
    "duplicates": [
      {
        "source_review_id": "existing-external-id",
        "reason": "already_imported"
      }
    ]
  }
}
```

### Sentiment

- `POST /sentiment/analyze`
- `POST /sentiment/analyze-batch`
- `GET /sentiment/reviews/{review_id}`

All sentiment routes:
- require `X-User-Id`
- enforce access to the target review business scope

`POST /sentiment/analyze`:
- request body: `review_id`, optional `language_hint`
- lowercases `language_hint` when present
- loads the stored review
- runs provider analysis
- updates the latest stored sentiment row for the review when one already exists
- returns the stored sentiment result plus `agent_run_id`

`POST /sentiment/analyze-batch`:
- request body: `review_ids`, optional `language_hint`
- returns partial success with `results` and `failures`

`GET /sentiment/reviews/{review_id}`:
- returns the latest stored sentiment result
- returns `404 SENTIMENT_RESULT_NOT_FOUND` if the review exists but no sentiment has been stored yet

Provider status:
- service logic and persistence are real
- provider output is currently mock-backed

Sentiment success example:

```json
{
  "success": true,
  "data": {
    "review_id": "uuid",
    "sentiment_result": {
      "id": "uuid",
      "review_id": "uuid",
      "label": "negative",
      "confidence": 0.93,
      "detected_language": "ar",
      "summary_tags": [
        "service",
        "needs_attention"
      ],
      "model_name": "mock_sentiment",
      "processed_at": "2026-03-19T08:10:00Z",
      "created_at": "2026-03-19T08:10:00Z"
    },
    "agent_run_id": "uuid"
  }
}
```

Batch sentiment success example:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "review_id": "uuid",
        "sentiment_result": {
          "id": "uuid",
          "review_id": "uuid",
          "label": "positive",
          "confidence": 0.86,
          "detected_language": "en",
          "summary_tags": [
            "customer_praise"
          ],
          "model_name": "mock_sentiment",
          "processed_at": "2026-03-19T08:10:00Z",
          "created_at": "2026-03-19T08:10:00Z"
        },
        "agent_run_id": "uuid"
      }
    ],
    "failures": [
      {
        "review_id": "uuid",
        "error_code": "REVIEW_NOT_FOUND",
        "message": "Review not found."
      }
    ]
  }
}
```

### Content

- `POST /content/generate/reply`
- `POST /content/generate/marketing`
- `POST /content/regenerate`
- `POST /content/save`
- `GET /content/{content_id}`

All content routes:
- require `X-User-Id`
- enforce business ownership or generated-content ownership scope through backend authorization

`POST /content/generate/reply`:
- request body: `business_id`, `review_id`, `language`, optional `tone`, optional `business_context`
- lowercases `language` and `tone`
- verifies the review belongs to the requested business
- returns persisted generated content plus `agent_run_id`

`POST /content/generate/marketing`:
- request body: `business_id`, `language`, optional `tone`, optional `business_context`, optional `prompt_context`
- returns persisted generated content plus `agent_run_id`

`POST /content/regenerate`:
- request body: `content_id`, `language`, optional `tone`, optional `business_context`, optional `prompt_context`
- creates a new generated content row
- does not overwrite the previous row

`POST /content/save`:
- request body: `content_id`, `edited_text`
- the schema also accepts `created_by_user_id`, but the route always overwrites it with the authenticated user id
- saves edited text onto the existing generated content row

`GET /content/{content_id}`:
- returns one stored generated content row

Provider status:
- service logic and persistence are real
- generated text is currently mock-backed

Reply generation example:

```json
{
  "success": true,
  "data": {
    "generated_content": {
      "id": "uuid",
      "business_id": "uuid",
      "review_id": "uuid",
      "content_type": "review_reply",
      "language": "ar",
      "tone": "professional",
      "prompt_context": {
        "provider": "mock_content",
        "content_type": "review_reply",
        "language": "ar",
        "tone": "professional",
        "input_context": {
          "source_type": "google",
          "business_name": "Cafe Amal",
          "business_context": "local coffee shop"
        }
      },
      "generated_text": "...",
      "edited_text": null,
      "created_by_user_id": null,
      "created_at": "2026-03-19T08:50:00Z",
      "updated_at": "2026-03-19T08:50:00Z"
    },
    "agent_run_id": "uuid"
  }
}
```

Save content example:

```json
{
  "success": true,
  "data": {
    "generated_content": {
      "id": "uuid",
      "business_id": "uuid",
      "review_id": "uuid",
      "content_type": "review_reply",
      "language": "en",
      "tone": "professional",
      "prompt_context": {},
      "generated_text": "...",
      "edited_text": "Updated copy the user approved.",
      "created_by_user_id": "uuid",
      "created_at": "2026-03-19T08:50:00Z",
      "updated_at": "2026-03-19T08:55:00Z"
    }
  }
}
```

### Agents

- `POST /agents/route`
- `POST /agents/run`
- `GET /agents/runs/{run_id}`

All agent routes:
- require `X-User-Id`
- enforce business, review, or run ownership before execution or lookup

Supported tasks only:
- `import_reviews`
- `analyze_review`
- `analyze_review_batch`
- `generate_reply`
- `generate_marketing_copy`
- `get_review_summary`

Unsupported tasks:
- return `400 UNSUPPORTED_TASK`
- forecasting and trend tasks are intentionally not routable

Invalid orchestrated payloads:
- return `422 INVALID_TASK_PAYLOAD`

`POST /agents/route` example:

```json
{
  "success": true,
  "data": {
    "task_type": "generate_reply",
    "status": "supported",
    "agent_name": "content_generation",
    "service_name": "ContentGenerationService"
  }
}
```

`POST /agents/run` example:

```json
{
  "success": true,
  "data": {
    "task_type": "generate_reply",
    "status": "success",
    "data": {
      "generated_content": {
        "id": "uuid",
        "business_id": "uuid",
        "content_type": "review_reply",
        "language": "en",
        "generated_text": "Thank you for your review."
      },
      "agent_run_id": "uuid"
    },
    "meta": {
      "agent": "content_generation",
      "agent_run_id": "uuid"
    }
  }
}
```

### Settings

- `GET /settings`
- `PATCH /settings/theme`
- `PATCH /settings/language`

All settings routes:
- require `X-User-Id`

`GET /settings`:
- returns the authenticated user's stored preferences

`PATCH /settings/theme`:
- request body: `{ "theme_preference": "light" | "dark" | "system" }`

`PATCH /settings/language`:
- request body: `{ "language_preference": "ar" | "en" }`

Settings example:

```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "language_preference": "en",
    "theme_preference": "dark",
    "updated_at": "2026-03-19T09:25:00Z"
  }
}
```

## 5. Error Codes

Auth and identity:
- `401 AUTHENTICATION_REQUIRED`
- `401 INVALID_AUTHENTICATED_USER`
- `404 AUTHENTICATED_USER_NOT_FOUND`

Authorization and scoping:
- `403 FORBIDDEN`
- `400 REVIEW_BUSINESS_SCOPE_MISMATCH`

Missing resources:
- `404 BUSINESS_NOT_FOUND`
- `404 REVIEW_NOT_FOUND`
- `404 GENERATED_CONTENT_NOT_FOUND`
- `404 SENTIMENT_RESULT_NOT_FOUND`
- `404 AGENT_RUN_NOT_FOUND`

Request validation:
- `422 VALIDATION_ERROR`
- `422 INVALID_TASK_PAYLOAD`

Provider or persistence failures:
- `409 REVIEW_IMPORT_CONFLICT`
- `502 SENTIMENT_PROVIDER_ERROR`
- `502 CONTENT_PROVIDER_ERROR`
- `500 INTERNAL_SERVER_ERROR`

Unhandled backend failures:
- are returned as `500 INTERNAL_SERVER_ERROR`
- do not include raw exception text

## 6. Deployment-Relevant Environment Variables

Currently used directly by the backend runtime:
- `APP_ENV`
- `DATABASE_URL`
- `API_V1_PREFIX`
- `UVICORN_HOST`
- `UVICORN_PORT`
- `PORT`
- `LOG_LEVEL`
- `DOCS_URL`
- `REDOC_URL`
- `OPENAPI_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SENTIMENT_PROVIDER`
- `CONTENT_PROVIDER`
- `GOOGLE_REVIEW_PROVIDER`
- `FACEBOOK_REVIEW_PROVIDER`
- `REVIEW_INTELLIGENCE_PROVIDER`

Current provider support:
- `mock` is the only implemented provider value for all provider settings

## 7. Documentation Rule

Whenever the backend contract changes:
- update this file
- update `WORK_LOG.md`
- mention whether frontend consumers or UI behavior changed
