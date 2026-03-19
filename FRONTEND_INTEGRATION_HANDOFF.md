# FRONTEND_INTEGRATION_HANDOFF.md

# Frontend Integration Handoff

## 1. Quick Start

Base URLs and local ports:
- backend HTTP base URL: `http://localhost:8000`
- backend route prefix: `API_V1_PREFIX` and it defaults to empty
- disposable smoke Postgres port: `54329`

Auth requirement today:
- every protected backend request must send `X-User-Id: <user-uuid>`
- the UUID must match a stored backend user
- this is temporary scaffolding, not final production auth

Current browser limitation:
- the backend does not configure CORS middleware yet
- cross-origin browser requests will fail unless the frontend uses same-origin delivery, a dev proxy, or the backend is updated to add CORS

## 2. Routes Ready For Frontend Use

These routes are implemented, persisted, and safe to integrate against:
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

These routes are implemented but mock-backed at the provider layer:
- `POST /sentiment/analyze`
- `POST /sentiment/analyze-batch`
- `POST /content/generate/reply`
- `POST /content/generate/marketing`
- `POST /content/regenerate`

These ingestion routes exist but are still dev-tooling oriented:
- `POST /reviews/import/google`
- `POST /reviews/import/facebook`

## 3. Common Contract

Success envelope:

```json
{
  "success": true,
  "data": {}
}
```

Error envelope:

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

Frontend-relevant status and error codes:
- `401 AUTHENTICATION_REQUIRED`
- `401 INVALID_AUTHENTICATED_USER`
- `404 AUTHENTICATED_USER_NOT_FOUND`
- `403 FORBIDDEN`
- `400 REVIEW_BUSINESS_SCOPE_MISMATCH`
- `404 BUSINESS_NOT_FOUND`
- `404 REVIEW_NOT_FOUND`
- `404 GENERATED_CONTENT_NOT_FOUND`
- `404 SENTIMENT_RESULT_NOT_FOUND`
- `422 VALIDATION_ERROR`
- `502 SENTIMENT_PROVIDER_ERROR`
- `502 CONTENT_PROVIDER_ERROR`
- `500 INTERNAL_SERVER_ERROR`

## 4. Working Flow Notes

Review flows:
- fetch `business_id` from `GET /auth/me` first
- `GET /reviews/{review_id}` requires `business_id` as a query param
- `PATCH /reviews/{review_id}/status` also requires `business_id` as a query param
- review list filters normalize `source_type`, `language`, `reviewer_name`, and `search_text` to lowercase

Sentiment flows:
- batch analysis can partially succeed
- use `data.results` and `data.failures` independently
- `GET /sentiment/reviews/{review_id}` returns the latest stored sentiment result only

Content flows:
- reply generation requires both `business_id` and `review_id`
- regeneration creates a new row and does not overwrite the original generated content
- `POST /content/save` ignores any client-supplied `created_by_user_id` and stamps the authenticated backend user instead
- generated content remains editable through `edited_text`

## 5. Request and Response Examples

`GET /auth/me`

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

`POST /sentiment/analyze`

```json
{
  "review_id": "uuid",
  "language_hint": "ar"
}
```

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

`POST /content/generate/reply`

```json
{
  "business_id": "uuid",
  "review_id": "uuid",
  "language": "ar",
  "tone": "professional",
  "business_context": "local coffee shop"
}
```

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

`POST /content/save`

```json
{
  "content_id": "uuid",
  "edited_text": "Updated copy the user approved."
}
```

## 6. Backend Environment Variables Frontend Needs To Know

Directly relevant to frontend integration:
- `API_V1_PREFIX`
- `APP_ENV`
- `DOCS_URL`
- `REDOC_URL`
- `OPENAPI_URL`
- `SENTIMENT_PROVIDER`
- `CONTENT_PROVIDER`

Important clarification:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist in backend config, but the current backend request auth boundary still does not verify Supabase tokens
- `SUPABASE_ANON_KEY` is not a backend env var in this repo's current server implementation

## 7. Known Limitations

- auth is still the temporary `X-User-Id` header boundary
- no backend CORS middleware is configured
- provider-backed AI output is mock-generated
- Google and Facebook source import routes are not live platform integrations yet
- true production rollout remains blocked until backend token or session verification replaces the temporary auth boundary

## 8. Integration Support Priorities

When frontend integration starts, the most likely backend follow-ups are:
- add or configure CORS for the actual frontend origin
- replace the temporary auth boundary with real backend token or session verification
- tighten error-code handling if the UI needs more specific states
- adjust request or response shapes only if the frontend proves a real contract mismatch
- rerun smoke checks after any integration-driven contract change
