# FRONTEND_INTEGRATION_HANDOFF.md

# Frontend Integration Handoff

## Scope

This handoff covers the backend endpoints the frontend task plan explicitly depends on:
- review retrieval and detail actions
- sentiment endpoints
- content generation endpoints

It also includes:
- auth requirements
- common response envelopes
- known error cases
- runtime env vars the frontend team needs to know about
- which endpoints are real vs mock-backed

## Base URL

- default local backend base URL: `http://localhost:8000`
- optional route prefix: `API_V1_PREFIX`
- current default `API_V1_PREFIX` is empty, so routes are mounted directly at `/...`

If `API_V1_PREFIX` is set in a deployed environment, prepend it to every path below.

## Current Auth Boundary

All protected endpoints below currently require:
- header: `X-User-Id: <user-uuid>`

Important:
- this is a temporary backend auth boundary
- the backend looks up that user in the database
- there is no real Supabase session-token verification yet
- frontend work should treat this as a dev/scaffold auth mechanism, not a final production auth flow

Useful auth endpoint:

### `GET /auth/me`

Purpose:
- fetch the authenticated user and the businesses they own

Headers:
- `X-User-Id`

Response body:
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

Frontend note:
- use this to get the current `business_id` values the user can legally scope other requests to

## Common Response Envelopes

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": []
  }
}
```

## Review Endpoints

These endpoints are real and backed by persisted database records.

### `GET /reviews`

Purpose:
- list reviews for a specific business

Headers:
- `X-User-Id`

Query params:
- `business_id` required, UUID
- `review_source_id` optional, UUID
- `source_type` optional, string
- `status` optional: `pending | reviewed | responded`
- `language` optional, string
- `min_rating` optional, integer `1..5`
- `max_rating` optional, integer `1..5`
- `reviewer_name` optional, string
- `search_text` optional, string
- `created_from` optional, ISO datetime
- `created_to` optional, ISO datetime
- `limit` optional, integer, default `50`, max `100`
- `offset` optional, integer, default `0`

Normalization behavior:
- `source_type`, `language`, `reviewer_name`, and `search_text` are trimmed and lowercased

Response body:
```json
{
  "success": true,
  "data": [
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
        "platform_location_id": "abc123"
      },
      "review_created_at": "2026-03-17T10:00:00Z",
      "ingested_at": "2026-03-19T05:44:00Z",
      "status": "pending",
      "response_status": null,
      "created_at": "2026-03-19T05:44:00Z",
      "updated_at": "2026-03-19T05:44:00Z"
    }
  ]
}
```

### `GET /reviews/{review_id}`

Purpose:
- fetch a single review detail

Headers:
- `X-User-Id`

Query params:
- `business_id` required, UUID

Response body:
- same review object shape as list items

Frontend note:
- `business_id` is required even though `review_id` is already in the path
- missing it returns `422 VALIDATION_ERROR`

### `PATCH /reviews/{review_id}/status`

Purpose:
- update workflow status for a review

Headers:
- `X-User-Id`

Query params:
- `business_id` required, UUID

Request body:
```json
{
  "status": "reviewed"
}
```

Allowed values:
- `pending`
- `reviewed`
- `responded`

Response body:
- same review object shape as list items

## Sentiment Endpoints

These endpoints are real, persisted, and usable by frontend flows.

Provider status:
- backend logic is real
- sentiment generation is currently backed by a mock provider with heuristic English/Arabic classification

### `POST /sentiment/analyze`

Purpose:
- analyze one stored review and persist the latest sentiment result

Headers:
- `X-User-Id`

Request body:
```json
{
  "review_id": "uuid",
  "language_hint": "ar"
}
```

Notes:
- `language_hint` is optional
- if provided, it is lowercased

Response body:
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
      "summary_tags": ["service", "needs_attention"],
      "model_name": "mock_sentiment",
      "processed_at": "2026-03-19T08:10:00Z",
      "created_at": "2026-03-19T08:10:00Z"
    },
    "agent_run_id": "uuid"
  }
}
```

### `POST /sentiment/analyze-batch`

Purpose:
- analyze multiple stored reviews in one call

Headers:
- `X-User-Id`

Request body:
```json
{
  "review_ids": ["uuid", "uuid"],
  "language_hint": "en"
}
```

Response body:
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
          "summary_tags": ["customer_praise"],
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

Frontend note:
- batch calls can succeed partially
- handle `results` and `failures` independently

### `GET /sentiment/reviews/{review_id}`

Purpose:
- fetch the latest stored sentiment result for a review

Headers:
- `X-User-Id`

Response body:
- same `sentiment_result` object shape shown above, without `agent_run_id`

## Content Endpoints

These endpoints are real, persisted, and usable by frontend flows.

Provider status:
- backend persistence and routing are real
- generated text is currently backed by a mock content provider

### `POST /content/generate/reply`

Purpose:
- generate and persist a review reply for one review

Headers:
- `X-User-Id`

Request body:
```json
{
  "business_id": "uuid",
  "review_id": "uuid",
  "language": "ar",
  "tone": "professional",
  "business_context": "local coffee shop"
}
```

Notes:
- `language` is required and lowercased
- `tone` is optional and lowercased when present
- `business_context` is optional
- backend enforces that the review must belong to the specified business

Response body:
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

### `POST /content/generate/marketing`

Purpose:
- generate and persist marketing copy for a business

Headers:
- `X-User-Id`

Request body:
```json
{
  "business_id": "uuid",
  "language": "en",
  "tone": "friendly",
  "business_context": "Cafe Amal",
  "prompt_context": {
    "audience": "locals"
  }
}
```

Response body:
```json
{
  "success": true,
  "data": {
    "generated_content": {
      "id": "uuid",
      "business_id": "uuid",
      "review_id": null,
      "content_type": "marketing_copy",
      "language": "en",
      "tone": "friendly",
      "prompt_context": {
        "provider": "mock_content",
        "content_type": "marketing_copy",
        "language": "en",
        "tone": "friendly",
        "input_context": {
          "business_name": "Cafe Amal",
          "business_context": "Cafe Amal",
          "audience": "locals"
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

### `POST /content/regenerate`

Purpose:
- create a new generated content row from an existing generated content record plus optional overrides

Headers:
- `X-User-Id`

Request body:
```json
{
  "content_id": "uuid",
  "language": "en",
  "tone": "professional",
  "business_context": "Cafe Amal",
  "prompt_context": {
    "retry_reason": "shorter"
  }
}
```

Response body:
- same shape as the other content generation endpoints:
- `data.generated_content`
- `data.agent_run_id`

Frontend note:
- regeneration creates a new content row, it does not overwrite the old one

### `POST /content/save`

Purpose:
- save user-edited text onto an existing generated content record

Headers:
- `X-User-Id`

Request body:
```json
{
  "content_id": "uuid",
  "edited_text": "Updated copy the user approved."
}
```

Important:
- do not send `created_by_user_id`
- the backend stamps `created_by_user_id` from the authenticated user

Response body:
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

### `GET /content/{content_id}`

Purpose:
- fetch one stored generated content record

Headers:
- `X-User-Id`

Response body:
- the `GeneratedContentRead` object shown above

## Known Errors

These are the main frontend-relevant error cases currently implemented.

### Auth / identity

- `401 AUTHENTICATION_REQUIRED`
  - missing `X-User-Id`
- `401 INVALID_AUTHENTICATED_USER`
  - header is present but not a valid UUID
- `404 AUTHENTICATED_USER_NOT_FOUND`
  - header UUID does not match a stored user

### Authorization / business scope

- `403 FORBIDDEN`
  - authenticated user does not own or cannot access the requested business
- `400 REVIEW_BUSINESS_SCOPE_MISMATCH`
  - content reply generation received a `business_id` that does not match the review's stored business

### Not found

- `404 BUSINESS_NOT_FOUND`
- `404 REVIEW_NOT_FOUND`
- `404 GENERATED_CONTENT_NOT_FOUND`
- `404 SENTIMENT_RESULT_NOT_FOUND`

### Validation

- `422 VALIDATION_ERROR`
  - request body/query/path did not match the schema
- `422 INVALID_TASK_PAYLOAD`
  - only relevant for `/agents/*`, not needed for the core frontend routes above

### Provider / backend failure

- `409 REVIEW_IMPORT_CONFLICT`
  - import collided with an existing persisted record
- `502 SENTIMENT_PROVIDER_ERROR`
  - sentiment provider failed
- `502 CONTENT_PROVIDER_ERROR`
  - content provider failed
- `500 INTERNAL_SERVER_ERROR`
  - unhandled backend error
  - current implementation intentionally does not expose raw internal exception text

## Which Endpoints Are Real vs Stubbed

### Real and ready for frontend integration

- `GET /auth/me`
- `GET /reviews`
- `GET /reviews/{review_id}`
- `PATCH /reviews/{review_id}/status`
- `POST /sentiment/analyze`
- `POST /sentiment/analyze-batch`
- `GET /sentiment/reviews/{review_id}`
- `POST /content/generate/reply`
- `POST /content/generate/marketing`
- `POST /content/regenerate`
- `POST /content/save`
- `GET /content/{content_id}`

Meaning of "real":
- route exists
- auth and authorization checks exist
- service logic exists
- response envelope is stable
- persistence is implemented

### Implemented but mock-backed

- `POST /sentiment/analyze`
- `POST /sentiment/analyze-batch`
- `POST /content/generate/reply`
- `POST /content/generate/marketing`
- `POST /content/regenerate`

Reason:
- backend routing and persistence are real
- model/provider output currently comes from mock providers, not production AI providers

### Not needed for the immediate frontend task plan, but currently stubbed/dev-oriented

- `POST /reviews/import/google`
- `POST /reviews/import/facebook`

Reason:
- these routes are implemented
- fetch behavior is still mock/dev provider based unless `mock_reviews` are supplied
- they are better treated as admin/dev tooling until real platform integrations are added

## Env Vars Frontend Team Should Know About

These are the backend env vars that directly affect frontend integration behavior.

### Routing / URLs

- `API_V1_PREFIX`
  - changes the base path for all API routes
- `DOCS_URL`
- `REDOC_URL`
- `OPENAPI_URL`

### Auth/platform context

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Important:
- the backend currently does not verify Supabase tokens yet
- frontend may still use Supabase client-side, but backend protection is currently the temporary `X-User-Id` boundary

### Backend runtime signals

- `APP_ENV`
  - useful when frontend wants environment-specific behavior or diagnostics

### Backend provider modes that affect UX expectations

- `SENTIMENT_PROVIDER`
  - currently only supported value is `mock`
- `CONTENT_PROVIDER`
  - currently only supported value is `mock`
- `GOOGLE_REVIEW_PROVIDER`
  - currently only supported value is `mock`
- `FACEBOOK_REVIEW_PROVIDER`
  - currently only supported value is `mock`
- `REVIEW_INTELLIGENCE_PROVIDER`
  - currently only supported value is `mock`

## Frontend Implementation Notes

- always fetch or cache `business_id` from `GET /auth/me` before calling business-scoped routes
- include `business_id` on review list/detail/status and content generation flows where required
- treat batch sentiment as partial success capable
- do not trust content generation text as final UX copy quality yet because provider output is mock-backed
- do not send `created_by_user_id` on content save
- handle `401`, `403`, `404`, `422`, and `502` separately in UI states
