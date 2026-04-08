# API Reference

Base URL: `http://localhost:8000`

## Preferred Endpoints

### `POST /review-jobs`

Creates a background Google review collection job.

Request body:

```json
{
  "business_name": "Cafe Amal Amman",
  "lang": "en",
  "depth": 1,
  "exact_place_locator": "https://www.google.com/maps/search/?api=1&query_place_id=..."
}
```

Response:

```json
{
  "job_id": "uuid",
  "business_name": "Cafe Amal Amman",
  "status": "queued",
  "provider_status": "pending",
  "message": "Google review collection started for Cafe Amal Amman.",
  "candidates": [],
  "started_at": "2026-04-08T08:00:00Z",
  "finished_at": null
}
```

### `GET /review-jobs/{job_id}`

Returns the latest job status.

Possible statuses:

- `queued`
- `running`
- `needs_selection`
- `success`
- `failed`

When the status is `needs_selection`, the response includes `candidates`.

### `GET /review-jobs/{job_id}/reviews`

Downloads reviews once the job is ready.

Query parameters:

- `business_name` required
- `candidate_id` optional

If the job matched multiple places, `candidate_id` is required.

Response:

```json
{
  "job_id": "uuid",
  "business_name": "Cafe Amal Amman",
  "reviews": [
    {
      "author": "Jane Doe",
      "rating": 4.0,
      "text": "Lovely atmosphere and friendly staff.",
      "date": "2 months ago"
    }
  ]
}
```

### `POST /review-candidates`

Returns matching Google place candidates for a business name. This endpoint is
mainly a helper or compatibility route and may still take a while because it
performs a live scrape.

## Compatibility Endpoint

### `POST /reviews`

Fetches reviews in one blocking request and returns the first matched place.

Request body:

```json
{
  "business_name": "Cafe Amal Amman",
  "lang": "en",
  "depth": 1
}
```

## Error Behavior

- `404` when a job or selected candidate cannot be found.
- `409` when reviews are requested before the job is ready, or when a candidate
  must be chosen first.
- `502` when the underlying scraper fails or times out.

## Review Extraction Notes

- Place search and review download are separate stages. A Google candidate can
  match successfully while review download still fails if the wrong review
  identifier is used.
- The review downloader resolves the raw Google place token from the matched
  place link, then fetches review payloads through the browser session.
- This service expects Playwright Chromium to be available in the API runtime.
- Jobs should run under a single API worker because background review jobs are
  created in-process with `asyncio.create_task(...)`.
