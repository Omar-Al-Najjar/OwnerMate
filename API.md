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

Current implementation notes:
- `GET /health` returns a basic backend liveness payload
- `GET /ready` returns readiness based on backend dependency configuration plus a lightweight database connectivity probe
- `GET /ready` returns `503` when required backend configuration is missing or the configured database is unreachable
- `GET /ready` now also surfaces the current backend auth-boundary assumption and whether Alembic migration config is present in the deployed runtime

### Auth / Session
- `GET /auth/me`
- `POST /auth/logout`

Current implementation notes:
- `GET /auth/me` requires authentication and returns the authenticated user plus the businesses currently owned by that user
- `POST /auth/logout` requires authentication, returns a structured signed-out payload, and clears common auth cookie names on the backend response boundary
- the current backend auth boundary is still driven by the authenticated request user dependency, which presently accepts the `X-User-Id` header until the full session provider integration is wired in
- backend privileged secrets remain server-side; no service-role key is exposed through these endpoints

### Reviews
- `GET /reviews`
- `GET /reviews/{review_id}`
- `POST /reviews/import`
- `POST /reviews/import/google`
- `POST /reviews/import/facebook`
- `PATCH /reviews/{review_id}/status`

Current implementation notes:
- all review endpoints require authentication and verify the authenticated user can access the requested business scope before reading or mutating data
- `GET /reviews` requires `business_id` as a query parameter
- `GET /reviews` supports optional `review_source_id`, `source_type`, `status`, `language`, `min_rating`, `max_rating`, `reviewer_name`, `search_text`, `created_from`, `created_to`, `limit`, and `offset` query filters
- `GET /reviews/{review_id}` requires `business_id` as a query parameter so the stored review detail is business-scoped
- `POST /reviews/import` accepts a batch payload, optionally scopes imported reviews to a nullable `review_source_id`, preserves per-review `source_metadata`, normalizes incoming review fields, skips duplicates, and persists only new rows
- `POST /reviews/import/google` accepts a Google-specific source request, fetches reviews through a provider boundary, normalizes them into the shared import schema, preserves Google metadata, and reuses the common deduplication/persistence flow
- `POST /reviews/import/facebook` accepts a Facebook-specific source request, fetches reviews through a provider boundary, normalizes them into the shared import schema, preserves Facebook metadata, and reuses the common deduplication/persistence flow
- Google and Facebook ingestion are currently backed by mock/dev providers only; the live platform fetch path is intentionally left behind explicit TODO boundaries
- duplicate protection is based on `business_id + source + source_review_id` plus same-payload duplicate detection
- `PATCH /reviews/{review_id}/status` requires `business_id` as a query parameter and updates only the review workflow status

### Sentiment
- `POST /sentiment/analyze`
- `POST /sentiment/analyze-batch`
- `GET /sentiment/reviews/{review_id}`

Current implementation notes:
- all sentiment endpoints require authentication and verify the authenticated user can access the underlying review business scope
- `POST /sentiment/analyze` validates the request, loads the stored review, analyzes it through the configured provider boundary, persists the result to `sentiment_results`, and returns the stored result plus `agent_run_id`
- `POST /sentiment/analyze-batch` analyzes each requested review through the same service layer and returns both successful results and per-review failures when some review ids are invalid
- `GET /sentiment/reviews/{review_id}` returns the latest persisted sentiment result for the review
- duplicate sentiment rows are avoided where practical by updating the latest stored result for a review instead of inserting another row on repeated analysis requests
- the current sentiment provider is a mock/dev provider with Arabic- and English-oriented keyword heuristics behind a swappable provider interface

### Content Generation
- `POST /content/generate/reply`
- `POST /content/generate/marketing`
- `POST /content/regenerate`
- `POST /content/save`
- `GET /content/{content_id}`

Current implementation notes:
- all content endpoints require authentication and verify the authenticated user can access the underlying business scope or stored content record before proceeding
- `POST /content/generate/reply` validates the request, loads the business and review context, builds provider input in the service layer, persists a generated review reply, and returns the stored content plus `agent_run_id`
- `POST /content/generate/marketing` validates the request, builds marketing-copy prompt context in the service layer, persists the generated content, and returns the stored content plus `agent_run_id`
- `POST /content/regenerate` loads an existing generated content record, rebuilds provider input from the stored content plus override inputs, persists a new generated content row, and preserves regeneration metadata in `prompt_context`
- `POST /content/save` persists edited content onto an existing generated content record, keeps the output frontend-editable, and now sets `created_by_user_id` from the authenticated backend user instead of trusting a client-supplied user id
- `GET /content/{content_id}` returns a stored generated content record
- prompt context and content metadata are preserved on generated content rows
- the current content provider is a mock/dev provider behind a swappable provider interface

### Agents
- `POST /agents/route`
- `POST /agents/run`
- `GET /agents/runs/{run_id}`

Current implementation notes:
- all `/agents/*` endpoints now require authentication and verify the authenticated user can access the referenced business or review scope before routing, execution, or run reads
- `POST /agents/route` validates the requested payload and returns the specialized agent/service that will handle it
- `POST /agents/run` explicitly delegates only to in-scope backend services
- `GET /agents/runs/{run_id}` returns a persisted `agent_runs` record for orchestrated or specialized executions
- supported task types are limited to `import_reviews`, `analyze_review`, `analyze_review_batch`, `generate_reply`, `generate_marketing_copy`, and `get_review_summary`
- unsupported task names are rejected explicitly by the orchestration boundary with a structured `UNSUPPORTED_TASK` error
- `get_review_summary` now returns frontend-safe review intelligence limited to grounded pain points, praise themes, and actionable negative feedback derived from stored reviews and stored sentiment outputs
- no forecasting, trend, or predictive tasks are routable

### Settings / User Preferences
- `GET /settings`
- `PATCH /settings/theme`
- `PATCH /settings/language`

Current implementation notes:
- `GET /settings` returns the authenticated user's stored language and theme preferences
- `PATCH /settings/theme` updates the authenticated user's `theme_preference`
- `PATCH /settings/language` updates the authenticated user's `language_preference`
- current backend authentication for these endpoints is enforced through the request dependency using the `X-User-Id` header as the authenticated user boundary until the real auth/session integration is wired in

## 4. Example Schemas

### Review Import Request
```json
{
  "business_id": "uuid",
  "review_source_id": "uuid",
  "source": "google",
  "reviews": [
    {
      "source_review_id": "external-review-id",
      "reviewer_name": "Jane Doe",
      "rating": 5,
      "language": "en",
      "review_text": "Great service",
      "source_metadata": {
        "platform_location_id": "abc123"
      },
      "review_created_at": "2026-03-17T10:00:00Z",
      "status": "pending"
    }
  ]
}
```

### Google Review Import Request
```json
{
  "business_id": "uuid",
  "review_source_id": "uuid",
  "connection": {
    "account_id": "google-account-id",
    "location_id": "google-location-id"
  },
  "fetch": {
    "limit": 25,
    "since": "2026-03-01T00:00:00Z"
  },
  "mock_reviews": [
    {
      "review_id": "google-review-id",
      "reviewer_name": "Jane Doe",
      "star_rating": 5,
      "comment": "Great service",
      "language_code": "en",
      "create_time": "2026-03-17T10:00:00Z",
      "location_id": "google-location-id",
      "location_name": "Main Branch"
    }
  ]
}
```

### Facebook Review Import Request
```json
{
  "business_id": "uuid",
  "review_source_id": "uuid",
  "connection": {
    "page_id": "facebook-page-id"
  },
  "fetch": {
    "limit": 25,
    "since": "2026-03-01T00:00:00Z"
  },
  "mock_reviews": [
    {
      "review_id": "facebook-review-id",
      "reviewer_name": "Jane Doe",
      "recommendation": "positive",
      "rating": 5,
      "review_text": "Great service",
      "language_code": "en",
      "created_time": "2026-03-17T10:00:00Z",
      "page_id": "facebook-page-id"
    }
  ]
}
```

### Review Response
```json
{
  "id": "uuid",
  "business_id": "uuid",
  "review_source_id": "uuid",
  "source_type": "google",
  "source_review_id": "external-review-id",
  "rating": 4,
  "language": "en",
  "review_text": "Great service",
  "source_metadata": {
    "platform_location_id": "abc123"
  },
  "status": "pending",
  "review_created_at": "2026-03-17T10:00:00Z",
  "ingested_at": "2026-03-19T05:44:00Z"
}
```

### Review Import Response
```json
{
  "source": "google",
  "business_id": "uuid",
  "review_source_id": "uuid",
  "requested_count": 2,
  "imported_count": 1,
  "duplicate_count": 1,
  "processed_count": 2,
  "imported_reviews": [
    {
      "id": "uuid",
      "business_id": "uuid",
      "review_source_id": "uuid",
      "source_type": "google",
      "source_review_id": "external-review-id",
      "review_text": "Great service",
      "source_metadata": {
        "platform_location_id": "abc123"
      },
      "status": "pending",
      "ingested_at": "2026-03-19T05:44:00Z"
    }
  ],
  "duplicates": [
    {
      "source_review_id": "existing-external-id",
      "reason": "already_imported"
    }
  ]
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
  "id": "uuid",
  "review_id": "uuid",
  "label": "negative",
  "confidence": 0.93,
  "detected_language": "ar",
  "summary_tags": ["service", "needs_attention"],
  "model_name": "mock_sentiment",
  "processed_at": "2026-03-19T08:10:00Z",
  "created_at": "2026-03-19T08:10:00Z"
}
```

### Sentiment Analyze Response
```json
{
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
```

### Sentiment Analyze Batch Response
```json
{
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
```

### Generate Reply Request
```json
{
  "business_id": "uuid",
  "review_id": "uuid",
  "language": "ar",
  "tone": "professional",
  "business_context": "local coffee shop"
}
```

### Generate Reply Response
```json
{
  "generated_content": {
    "id": "uuid",
    "business_id": "uuid",
    "review_id": "uuid",
    "content_type": "review_reply",
    "language": "ar",
    "tone": "professional",
    "prompt_context": {
      "provider": "mock_content",
      "content_type": "review_reply"
    },
    "generated_text": "...",
    "edited_text": null,
    "created_by_user_id": null,
    "created_at": "2026-03-19T08:50:00Z",
    "updated_at": "2026-03-19T08:50:00Z"
  },
  "agent_run_id": "uuid"
}
```

### Generate Marketing Response
```json
{
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
      "business_context": "Cafe Amal"
    },
    "generated_text": "...",
    "edited_text": null,
    "created_by_user_id": null,
    "created_at": "2026-03-19T08:50:00Z",
    "updated_at": "2026-03-19T08:50:00Z"
  },
  "agent_run_id": "uuid"
}
```

### Save Content Request
```json
{
  "content_id": "uuid",
  "edited_text": "Updated copy the user approved."
}
```

Current implementation note:
- `POST /content/save` stamps `created_by_user_id` from the authenticated backend user and does not rely on a client-supplied user id

### Settings Response
```json
{
  "user_id": "uuid",
  "language_preference": "en",
  "theme_preference": "dark",
  "updated_at": "2026-03-19T09:25:00Z"
}
```

### Agent Route Request
```json
{
  "task": "generate_reply",
  "payload": {
    "business_id": "uuid",
    "review_id": "uuid"
  }
}
```

### Agent Route Response
```json
{
  "task_type": "generate_reply",
  "status": "supported",
  "agent_name": "content_generation",
  "service_name": "ContentGenerationService"
}
```

### Agent Run Response
```json
{
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
```

### Review Summary Result
```json
{
  "business_id": "uuid",
  "total_reviews": 24,
  "average_rating": 4.1,
  "status_counts": {
    "pending": 10,
    "reviewed": 14
  },
  "language_counts": {
    "en": 20,
    "ar": 4
  },
  "source_counts": {
    "google": 16,
    "facebook": 8
  },
  "latest_review_ids": ["uuid"],
  "intelligence": {
    "pain_points": [
      {
        "theme": "service",
        "review_count": 3,
        "sentiment_labels": ["negative"],
        "sample_review_ids": ["uuid"],
        "sample_excerpts": ["Slow service and delayed delivery."]
      }
    ],
    "praise_themes": [
      {
        "theme": "customer_praise",
        "review_count": 5,
        "sentiment_labels": ["positive"],
        "sample_review_ids": ["uuid"],
        "sample_excerpts": ["Friendly staff and amazing food."]
      }
    ],
    "actionable_negative_feedback": [
      {
        "review_id": "uuid",
        "source_type": "google",
        "language": "en",
        "rating": 1,
        "sentiment_label": "negative",
        "confidence": 0.92,
        "issue": "service",
        "review_excerpt": "Slow service and delayed delivery."
      }
    ]
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

Implemented health example:
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

Implemented validation errors follow the same envelope and include `details` when request validation fails.
Implemented auth failures use the same error envelope, with `401` for missing/invalid authentication and `403` for authenticated users outside the requested business scope.

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
