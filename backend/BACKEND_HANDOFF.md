# BACKEND_HANDOFF.md

# Backend Handoff

Local backend:
- base URL: `http://localhost:8000`
- route prefix: `API_V1_PREFIX`, currently empty
- smoke Postgres port: `54329`

Auth right now:
- protected routes require `X-User-Id: <user-uuid>`
- this is temporary scaffolding, not production-ready auth
- no CORS middleware is configured yet

Frontend-ready routes:
- reviews: `GET /reviews`, `GET /reviews/{review_id}`, `PATCH /reviews/{review_id}/status`
- sentiment: `POST /sentiment/analyze`, `POST /sentiment/analyze-batch`, `GET /sentiment/reviews/{review_id}`
- content: `POST /content/generate/reply`, `POST /content/generate/marketing`, `POST /content/regenerate`, `POST /content/save`, `GET /content/{content_id}`
- auth helper: `GET /auth/me`

Real vs mock:
- persistence, routing, auth checks, business scoping, and response envelopes are real
- sentiment and content provider output are mock-backed
- Google and Facebook source imports are implemented but still mock/dev-oriented

Most important backend env vars:
- required for live DB-backed runtime: `DATABASE_URL`
- commonly set: `APP_ENV`, `API_V1_PREFIX`, `PORT`, `LOG_LEVEL`
- provider flags: `SENTIMENT_PROVIDER`, `CONTENT_PROVIDER`, `GOOGLE_REVIEW_PROVIDER`, `FACEBOOK_REVIEW_PROVIDER`, `REVIEW_INTELLIGENCE_PROVIDER`
- optional in current runtime but present in config: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

Known blockers:
- real backend token or session verification is not implemented
- no cross-origin browser support is configured yet
- true production release is still `NO-GO` until auth is upgraded

Primary references:
- exact API contract: `API.md`
- frontend details and examples: `FRONTEND_INTEGRATION_HANDOFF.md`
- deployment flow: `DEPLOYMENT.md`
- rollout checklist: `PRODUCTION_ROLLOUT_RUNBOOK.md`
