# Google Reviews API

A FastAPI service that collects Google Maps reviews for OwnerMate. It uses the
`gosom/google-maps-scraper` container underneath, but exposes a backend-friendly
API with async review jobs and place-selection support.

## What It Supports

- `POST /reviews`
  Compatibility endpoint that blocks until reviews are ready.
- `POST /review-jobs`
  Creates a background review collection job and returns immediately.
- `GET /review-jobs/{job_id}`
  Polls job status.
- `GET /review-jobs/{job_id}/reviews`
  Downloads reviews after the job completes.
- `POST /review-candidates`
  Helper endpoint that returns matching Google place candidates for a business
  name. This still performs a live scrape and is slower than the async job flow.

## Recommended Flow

1. `POST /review-jobs` with `business_name`, optional `exact_place_locator`,
   `depth`, and `lang`.
2. Poll `GET /review-jobs/{job_id}` until the status becomes:
   - `success`
   - `failed`
   - `needs_selection`
3. If the job returns `needs_selection`, let the caller choose one candidate and
   call `GET /review-jobs/{job_id}/reviews?business_name=...&candidate_id=...`.
4. If the job returns `success`, call
   `GET /review-jobs/{job_id}/reviews?business_name=...`.

## Job Status Values

- `queued`
- `running`
- `needs_selection`
- `success`
- `failed`

## Local Run

```bash
docker compose up --build
```

The API is exposed on `http://localhost:8000`.

## Environment Variables

- `SCRAPER_BASE_URL`
  Default: `http://localhost:8080`
- `GOOGLE_REVIEW_JOB_STORAGE_DIR`
  Directory used to persist async job state across API workers.
- `GOOGLE_REVIEW_JOB_TIMEOUT_SECONDS`
  How long a queued/running job can remain unfinished before it is marked as
  timed out.

## Notes

- Google Maps scraping is still slow because it runs a real browser workflow.
- The async job endpoints are the preferred integration contract for OwnerMate.
- The compatibility `POST /reviews` route remains available for diagnostics and
  manual testing.
- Review text extraction uses a Playwright-backed browser session plus Google's
  internal review RPC endpoint. The review-fetching step relies on the raw place
  token embedded in the matched Google Maps place link, not only the
  `query_place_id` value.
- The API container should run with a single worker for async in-process job
  execution, and the image must include Playwright Chromium.
