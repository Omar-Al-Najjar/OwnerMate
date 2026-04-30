# WORK_LOG.md
> **Note:** Put this file at the repository root.

# Work Log

This file is mandatory.

Every coding agent working on this repository must append a new entry after each meaningful change.
Do not overwrite previous entries.
Do not skip documentation because the change feels small.

## Entry Template

```md
## YYYY-MM-DD HH:MM - Short change title

### Task
What was the task, issue, or goal?

### Files Changed
- path/to/file1
- path/to/file2

### What Was Done
- implemented X
- adjusted Y
- removed Z

### Why
Brief reason for the change.

### Testing
- unit test:
- manual test:
- not tested yet:

### Migrations / Env Changes
- none
- or describe exactly what changed

### Remaining Work / Notes
- follow-up item 1
- follow-up item 2
```

## Rules

* Append entries in chronological order.
* Be specific about files changed.
* Mention testing honestly.
* Mention if docs were updated.
* Mention any bug discovered during the change.
* Mention if the change affects API, DB schema, UI, or agents.

## Scope Reminder

Do not log work for excluded features as if they are part of the project.
If someone tries to add trend analysis or forecasting, that should be flagged as out of scope.

---

## Initial Entry

**2026-03-17 00:00 - Repository documentation initialized**

### Task
Create the core markdown documentation package for OwnerMate so coding agents have a stable implementation reference.

### Files Changed
* `README.md`
* `PRD.md`
* `ARCHITECTURE.md`
* `TECH_STACK.md`
* `TASKS.md`
* `API.md`
* `AGENTS.md`
* `DEPLOYMENT.md`
* `DATABASE_SCHEMA.md`
* `CODING_RULES.md`
* `WORK_LOG.md`

### What Was Done
* created implementation-facing project documentation
* aligned docs with the current tech stack
* explicitly removed trend analysis and forecasting from scope
* added mandatory change logging rules for future agent work

### Why
The project needs stable documentation before implementation begins so coding agents do not drift from scope or architecture.

### Testing
* manual review of markdown content

### Migrations / Env Changes
* none

### Remaining Work / Notes
* tailor these docs further once the repository structure is finalized
* update API and architecture docs as implementation becomes concrete

## 2026-04-06 18:55 - Split notebook into frontend-ready prototype contract

### Task
Refactor the dataset-analysis notebook into the `Agent prototype` `app.py` and `pipeline.py` split, then make the result suitable for frontend handoff.

### Files Changed
* `Agent prototype/pipeline.py`
* `Agent prototype/app.py`
* `AGENTS.md`
* `API.md`
* `WORK_LOG.md`

### What Was Done
* replaced the older prototype pipeline with a notebook-derived orchestration module
* added richer semantic/profile models, adaptive question floor logic, deduplication helpers, SQL self-healing, and refinement review flow
* introduced a stable frontend-safe envelope with `task_type`, `status`, `data`, `meta`, and `error`
* switched the Streamlit app to a thin reference shell that renders only the public pipeline contract
* moved credential expectations to server-side environment variables instead of per-user key entry
* documented the current prototype boundary and response contract in root docs

### Why
The frontend handoff needed a stable integration boundary so UI work can proceed without depending on notebook cells or internal LangGraph/Pydantic objects.

### Testing
* static review of the refactor
* import/runtime verification still pending in this session

### Migrations / Env Changes
* added required runtime env: `OWNERMATE_LLM_API_KEY`
* optional runtime env: `OWNERMATE_LLM_MODEL`, `OWNERMATE_LLM_BASE_URL`, `OWNERMATE_AGENT_TIMEOUT`, `OWNERMATE_BATCH_SIZE`

### Remaining Work / Notes
* verify the prototype against a real CSV and configured model key
* tighten prompts or result formatting if the frontend team wants a stricter wire contract
* this prototype still targets generic CSV analysis and is not yet the final OwnerMate review-ingestion/sentiment/content-generation flow

## 2026-04-06 19:05 - Add prototype env example

### Task
Add an example environment file for the dataset-analysis prototype so setup is clear for handoff.

### Files Changed
* `Agent prototype/.env.example`
* `README.md`
* `WORK_LOG.md`

### What Was Done
* added `Agent prototype/.env.example` with the current prototype runtime variables
* documented the env template and required key in `README.md`

### Why
The prototype was switched to server-side environment variables and needed a concrete example file for local setup and frontend handoff.

### Testing
* manual file review

### Migrations / Env Changes
* no code migrations
* added documented env template for the current prototype runtime

### Remaining Work / Notes
* if you want, the next useful step is adding a real `.gitignore` rule and a small setup section for `streamlit run`

## 2026-04-06 19:10 - Add env ignore rules and setup notes

### Task
Finish the prototype setup polish by ignoring local env files and documenting the local run flow.

### Files Changed
* `.gitignore`
* `Agent prototype/DOCUMENTATION.md`
* `WORK_LOG.md`

### What Was Done
* added a root `.gitignore` with env-file protection for the prototype
* documented the local setup flow for `.env.example` and `streamlit run app.py`

### Why
The frontend handoff is safer and easier to use when local secrets are ignored and the run steps are written down next to the prototype.

### Testing
* manual review of ignore rules and documentation

### Migrations / Env Changes
* no runtime code changes
* repository now ignores local `.env` files and Streamlit secrets files

### Remaining Work / Notes
* a future pass could add a dedicated setup script if the team wants one-command prototype startup

## 2026-04-06 19:20 - Make local env loading automatic and fix app launch path

### Task
Finish the local prototype setup so it can be launched directly from the `Agent prototype` folder.

### Files Changed
* `Agent prototype/pipeline.py`
* `Agent prototype/app.py`
* `Agent prototype/requirements.txt`
* `Agent prototype/DOCUMENTATION.md`
* `WORK_LOG.md`

### What Was Done
* added `python-dotenv` to the prototype dependencies
* updated `pipeline.py` to auto-load `Agent prototype/.env`
* created a local `.env` file from `.env.example`
* installed the missing `pydantic-ai` dependency in the selected Python environment
* fixed a Streamlit bare-mode fallthrough in `app.py` so the upload gate works correctly during import/runtime checks

### Why
The prototype needed to run from a normal local environment, not just on paper. Auto-loading `.env` removes one manual setup step and the app fix prevents early crashes during real launch-path testing.

### Testing
* `py_compile` passed for `Agent prototype/app.py`
* real-path import check passed for `pipeline.py`
* real-path bare-mode import check passed for `app.py`

### Migrations / Env Changes
* local runtime now auto-loads `Agent prototype/.env`
* added dependency: `python-dotenv`

### Remaining Work / Notes
* the current local `.env` still contains a placeholder API key unless replaced manually
* `pydantic-ai` upgraded shared packages in this Python environment, so if another project depends on older `openai`, `protobuf`, or `packaging`, use a dedicated virtual environment

## 2026-04-06 19:30 - Add local launcher scripts for Streamlit

### Task
Make the prototype easy to start without relying on a global `streamlit` PATH entry.

### Files Changed
* `Agent prototype/run-prototype.ps1`
* `Agent prototype/run-prototype.bat`
* `Agent prototype/DOCUMENTATION.md`
* `WORK_LOG.md`

### What Was Done
* added PowerShell and batch launchers that run `python -m streamlit run app.py`
* defaulted the launchers to the current local Python path and allowed override via `OWNERMATE_PYTHON`
* documented the new one-command startup options

### Why
The local machine does not expose `streamlit` on PATH, so repo-local launchers remove that setup friction.

### Testing
* manual review of launcher commands

### Migrations / Env Changes
* optional env override supported: `OWNERMATE_PYTHON`

### Remaining Work / Notes
* the prototype still needs a real API key in `Agent prototype/.env` before a full analysis run can succeed

## 2026-04-06 19:40 - Fix Kimi temperature setting

### Task
Resolve the provider error caused by sending an unsupported temperature to `kimi-k2.5`.

### Files Changed
* `Agent prototype/pipeline.py`
* `Agent prototype/.env.example`
* `Agent prototype/DOCUMENTATION.md`
* `README.md`
* `WORK_LOG.md`

### What Was Done
* added `temperature` to the runtime config
* changed the default model temperature from `0` to `0.6`
* exposed `OWNERMATE_LLM_TEMPERATURE` as an env override
* documented the Kimi-specific requirement in the env template and docs

### Why
`kimi-k2.5` rejects temperatures other than `0.6`, so the previous default caused every agent call to fail with a 400 response.

### Testing
* static code review of the provider settings change

### Migrations / Env Changes
* added optional env variable: `OWNERMATE_LLM_TEMPERATURE`

### Remaining Work / Notes
* if you switch away from `kimi-k2.5`, confirm the target model’s accepted temperature range before overriding this value

## 2026-04-07 14:10 - Added async dataset-analysis service wrapper and website contract

### Task
Expose the CSV analysis prototype as a separate async service and document the website integration boundary before wiring the frontend page to it.

### Files Changed
* `Agent prototype/api_service.py`
* `Agent prototype/run-service.ps1`
* `Agent prototype/run-service.bat`
* `Agent prototype/.env.example`
* `Agent prototype/requirements.txt`
* `Agent prototype/DOCUMENTATION.md`
* `AGENTS.md`
* `API.md`
* `WORK_LOG.md`

### What Was Done
* added a FastAPI wrapper around `run_analysis(...)` with in-memory async jobs
* added `GET /health`, `POST /jobs`, and `GET /jobs/{job_id}` for the prototype service
* protected the service with an internal secret header and owner-user scoping
* added launcher scripts and documented the local service run flow
* documented that the website will call this separate service through thin proxy routes instead of moving the agent into the main backend

### Why
The dataset-analysis prototype can take significant time to run, so it needed a separate runtime boundary that keeps the main OwnerMate backend responsive while still exposing a stable contract to the website.

### Testing
* `python -m py_compile Agent prototype/api_service.py`
* manual import/runtime verification of the FastAPI app is blocked in this environment because the current Python install is missing `nest_asyncio`

### Migrations / Env Changes
* added prototype service env: `DATASET_ANALYSIS_SERVICE_SECRET`
* added prototype service env: `DATASET_ANALYSIS_MAX_FILE_MB`
* added prototype service env: `DATASET_ANALYSIS_MAX_CONCURRENCY`
* added prototype service dependencies: `fastapi`, `python-multipart`, `uvicorn`

### Remaining Work / Notes
* UI behavior changed in the frontend worktree through a new `dataset-analysis` page and proxy API routes
* the main backend was intentionally left untouched for this CSV analysis flow

## 2026-04-07 19:35 - Hardened dataset-analysis retries for transient provider overload

### Task
Reduce false-negative dataset-analysis failures caused by temporary upstream provider overload and document the behavior change.

### Files Changed
* `Agent prototype/pipeline.py`
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* extended the prototype agent retry loop so overload and rate-limit style provider failures get more retry attempts than ordinary errors
* preserved the existing structured envelope while keeping detailed provider failure text available in the returned error payload
* documented that the dataset-analysis prototype now distinguishes transient provider overload from ordinary agent failures

### Why
Real CSV runs were reaching the configured model provider but failing on `429 engine_overloaded_error`, which made healthy pipelines look broken to the website user.

### Testing
* `python -m py_compile "Agent prototype/pipeline.py"`

### Migrations / Env Changes
* no migrations
* no required env changes

### Remaining Work / Notes
* UI behavior changed in the frontend worktree so the dataset-analysis page prefers detailed provider failure text when available
* API payload shape did not change; retry behavior and surfaced error detail changed

## 2026-04-07 19:48 - Fixed pandas StringDtype compatibility in dataset profiling

### Task
Stop CSV analysis runs from failing during dataframe profiling on modern pandas versions that use `StringDtype`.

### Files Changed
* `Agent prototype/pipeline.py`
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* replaced the dataframe-wide numeric column discovery path with a pandas dtype-safe check per column
* kept correlation generation behavior unchanged while avoiding `select_dtypes(include=[np.number])` crashes on mixed modern dtypes
* documented the runtime compatibility improvement for the dataset-analysis prototype

### Why
Uploaded CSV analysis jobs were failing before the agent completed because pandas raised `Cannot interpret '<StringDtype(na_value=nan)>' as a data type` during profiling.

### Testing
* `python -m py_compile "Agent prototype/pipeline.py"`
* manual `profile_dataframe(...)` verification against `jordan_transactions.csv`

### Migrations / Env Changes
* no migrations
* no env changes

### Remaining Work / Notes
* UI behavior did not change in this fix
* API payload shape did not change

## 2026-04-07 20:10 - Fixed unbound SQL batch result in dataset-analysis pipeline

### Task
Stop dataset-analysis jobs from failing in the SQL stage with `cannot access local variable 'result' where it is not associated with a value`.

### Files Changed
* `Agent prototype/pipeline.py`
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* moved the SQL agent call in `run_sql_batch(...)` outside the retry-feedback conditional so every batch executes the SQL agent regardless of whether refinement feedback is present
* kept the payload shape unchanged for both normal execution and retry execution
* documented the runtime fix for the dataset-analysis prototype boundary

### Why
Normal SQL batches without `retry_feedback` skipped the agent call entirely, leaving `result` undefined and causing jobs to fail mid-run.

### Testing
* `python -m py_compile "Agent prototype/pipeline.py"`

### Migrations / Env Changes
* no migrations
* no env changes

### Remaining Work / Notes
* UI behavior did not change in this fix
* API payload shape did not change

## 2026-04-07 20:35 - Restored the real sentiment model service from AI-system

### Task
Bring back the real bilingual sentiment model service from `AI-system` and make it available again for integration instead of relying on a mock-only path.

### Files Changed
* `AGENTS.md`
* `Sentiment analysis model/Dockerfile`
* `Sentiment analysis model/app/__init__.py`
* `Sentiment analysis model/app/main.py`
* `Sentiment analysis model/app/model.py`
* `Sentiment analysis model/docker-compose.yml`
* `Sentiment analysis model/docs/API.md`
* `Sentiment analysis model/docs/DEPLOYMENT.md`
* `Sentiment analysis model/model/adapter_config.json`
* `Sentiment analysis model/model/adapter_model.safetensors`
* `Sentiment analysis model/requirements.txt`
* `WORK_LOG.md`

### What Was Done
* restored the full Dockerized sentiment analysis service from `origin/AI-system`
* kept it as a separate runtime boundary instead of embedding model inference into the main backend
* adjusted the local compose port so it can run beside the main OwnerMate backend without conflicting on port `8000`

### Why
The repository already included a real XLM-RoBERTa + LoRA sentiment service, but the backend worktree had only been wired to a mock provider path. Restoring the service makes real model inference available again.

### Testing
* repository path verification of the restored service files

### Migrations / Env Changes
* local Docker compose for the sentiment model now defaults to host port `8030`

### Remaining Work / Notes
* UI behavior did not change in this step
* backend integration happens in the backend worktree and does not change frontend payloads

## 2026-04-08 10:55 - Fixed Google Maps review extraction so imported reviews appear

### Task
Resolve the Google Maps import failure where jobs could finish or hang without producing visible review text in OwnerMate.

### Files Changed
* `google-maps-api/app/review_page_client.py`
* `google-maps-api/app/review_jobs.py`
* `google-maps-api/tests/test_review_page_client.py`
* `google-maps-api/README.md`
* `google-maps-api/docs/API.md`
* `API.md`
* `WORK_LOG.md`

### What Was Done
* replaced the failing review-panel scraping path with a browser-session RPC fetch that requests Google review payloads directly from the internal `listugcposts` endpoint
* fixed place identifier resolution so review extraction uses the raw Google place token from the place link such as `0x...:0x...` instead of only relying on `query_place_id` values like `ChIJ...`
* merged fetched reviews with any already-parsed reviews instead of overwriting good data with empty fallback results
* normalized common Google text mojibake so imported review text is stored with readable Unicode characters
* added focused tests for place-id extraction and text normalization
* documented the real cause and the new review-fetching behavior in the service markdown docs and the root API reference

### Why
The previous flow could report successful Google place matching while still returning empty or failed review downloads because the selected place identifier was valid for lookup but invalid for the downstream review RPC call.

### Testing
* `python -m unittest C:\ownermate\OwnerMate\google-maps-api\tests\test_review_jobs.py C:\ownermate\OwnerMate\google-maps-api\tests\test_review_page_client.py`
* `$env:PYTHONPATH='C:\ownermate\OwnerMate-backend-branch'; python -m unittest backend.tests.test_source_review_import_service`
* `$env:PYTHONPATH='C:\ownermate\OwnerMate-backend-branch'; python -m unittest backend.tests.test_google_maps_review_provider`
* manual live test against `Starbucks, Abdali Mall, Amman 11190`
* verified live job `7b3bd53a-a482-4f75-a69b-527396c04219` completed with `success/done` and returned `200` reviews from `GET /review-jobs/{job_id}/reviews`

### Migrations / Env Changes
* no database migrations
* `google-maps-api` runtime requires Playwright Chromium inside the service image for review extraction

### Remaining Work / Notes
* the backend Google import flow can now consume real review text from `google-maps-api`
* terminal output such as PowerShell may still display Unicode poorly even when the stored JSON payload is correct

## 2026-04-07 20:02 - Normalized pandas timestamps before dataset-analysis JSON handoff

### Task
Prevent long-running dataset-analysis jobs from failing when pandas timestamp-like values reach JSON serialization boundaries.

### Files Changed
* `Agent prototype/pipeline.py`
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* added a recursive JSON-safe normalization helper for pandas timestamps, Python datetime values, pandas missing values, and numpy scalars
* routed agent payload serialization through the JSON-safe helper before every `json.dumps(...)` handoff between prototype stages
* normalized final dataset-analysis envelope sections such as dataset preview rows, semantic model data, findings, and refinement output

### Why
Real jobs were reaching the later stages of the analysis successfully and then failing with `Object of type Timestamp is not JSON serializable`, which stopped completed work from reaching the website.

### Testing
* `python -m py_compile "Agent prototype/pipeline.py"`
* manual JSON-safe serialization check for dataframe preview rows containing `pd.Timestamp`

### Migrations / Env Changes
* no migrations
* no env changes

### Remaining Work / Notes
* UI behavior did not change in this fix
* API payload shape did not change

## 2026-04-07 16:48 - Added Google Maps lookup by name, URL, or both

### Task
Upgrade the `google-maps-api` service so Google review lookup can use `business_name`, `google_maps_url`, or both, while preventing branch mix-ups caused by duplicate names.

### Files Changed
* `google-maps-api/app/models.py`
* `google-maps-api/app/main.py`
* `google-maps-api/app/scraper_client.py`
* `google-maps-api/tests/test_reviews_lookup.py`
* `google-maps-api/README.md`
* `google-maps-api/docs/API.md`
* `google-maps-api/docs/CODEBASE.md`
* `API.md`
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* made `business_name` optional and added optional `google_maps_url`, with validation that at least one lookup input is present
* added direct Google Maps place URL handling plus `maps.app.goo.gl` share-link resolution
* changed CSV handling from flattened reviews to per-place rows so the service can match the correct business by `place_id`, `cid`, data identifier, or canonicalized URL
* added lookup metadata to the response: `lookup_mode`, `matched_business_title`, `matched_google_maps_url`, and `warning`
* added structured lookup errors including `BUSINESS_LINK_MISMATCH`, `GOOGLE_MAPS_RESULT_NOT_FOUND`, and `UNSUPPORTED_GOOGLE_MAPS_URL`
* added focused automated tests for request validation, URL normalization, URL-only matching, name-only warning behavior, and structured mismatch responses
* updated service docs and root docs to record the payload change and frontend-facing warning/mismatch behavior

### Why
Name-only scraping can hit the wrong branch when businesses share similar names. Accepting and validating a Google Maps URL makes the lookup safer while preserving a `name_only` fallback path.

### Testing
* `python -m py_compile app\models.py app\main.py app\scraper_client.py`
* `python -m py_compile tests\test_reviews_lookup.py`
* `python -m unittest discover -s tests -v`

### Migrations / Env Changes
* no migrations
* no env changes

### Remaining Work / Notes
* API payload changed for `google-maps-api /reviews`
* UI behavior changed for consumers that surface the `warning` field and the `BUSINESS_LINK_MISMATCH` code

## 2026-04-07 22:35 - Reverted Google Maps lookup back to business-name only

### Task
Return the Google Maps review import flow to the earlier business-name-only behavior because the URL-aware path was no longer the preferred system behavior.

### Files Changed
* `google-maps-api/app/models.py`
* `google-maps-api/app/main.py`
* `google-maps-api/app/scraper_client.py`
* `google-maps-api/tests/test_reviews_lookup.py`
* `google-maps-api/README.md`
* `google-maps-api/docs/API.md`
* `google-maps-api/docs/CODEBASE.md`
* `API.md`
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* restored the Google Maps API request contract so `business_name` is required again
* removed URL-aware lookup, matching metadata, and structured mismatch handling from the service
* simplified the service tests to cover the restored name-only flow
* updated root and service docs so they no longer describe `google_maps_url`, `lookup_mode`, or mismatch codes

### Why
The preferred product behavior is now the simpler and earlier business-name-only lookup flow.

### Testing
* pending in this step: focused service tests are run after the wider backend/frontend revert is completed

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API payload changed again for `google-maps-api /reviews`: it now requires `business_name`
* UI behavior is expected to simplify back toward business-name-only Google import flows

## 2026-04-07 23:20 - Added locale-aware dataset-analysis job localization

### Task
Let completed dataset-analysis jobs be rehydrated in Arabic without rerunning the pipeline, while keeping the canonical stored result intact for debugging and fallback use.

### Files Changed
* `Agent prototype/api_service.py`
* `Agent prototype/localization.py`
* `API.md`
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* added optional `locale=en|ar` support to `GET /jobs/{job_id}`
* kept the canonical stored job result untouched and added per-job localized response caching for Arabic reads
* localized human-facing dataset-analysis result content for Arabic consumers, including questions, findings explanations, insights, semantic descriptions, and run-status text
* kept code, identifiers, raw logs, and clearly structured data outputs unchanged so debugging and data fidelity remain intact
* documented the new locale-aware prototype contract and UI-facing behavior

### Why
The dataset-analysis page needed to respect locale switches without forcing users to rerun long analysis jobs, and the service needed to do that without mutating its source-of-truth result envelope.

### Testing
* pending in this step: Python syntax verification is run after the frontend verification pass

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API behavior changed for `GET /jobs/{job_id}` through a new optional `locale` query parameter
* UI behavior changed in the frontend worktree because completed dataset-analysis jobs can now refresh into Arabic without rerunning

## 2026-04-07 20:55 - Mirrored dataset-analysis runs into agent_runs

### Task
Connect the authenticated dataset-analysis proxy flow to the shared `agent_runs` table so prototype analysis work is traceable like the other OwnerMate agent flows.

### Files Changed
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* documented that the website-side dataset-analysis proxy now mirrors prototype job lifecycle into `agent_runs` when business scope is available

### Why
The dataset-analysis prototype already carried business and user context through the authenticated proxy, but it was not writing any run-trace record into the shared observability table.

### Testing
* pending in this step: frontend verification is run in the frontend worktree after the proxy patch

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API payload did not change in this step
* UI behavior did not change in this step

## 2026-04-24 23:20 - Added Docker Compose support for dataset-analysis service

### Task
Wire the dataset-analysis API under `Agent prototype/` into a proper Docker Compose startup flow like the other OwnerMate services.

### Files Changed
* `Agent prototype/Dockerfile`
* `Agent prototype/docker-compose.yml`
* `Agent prototype/.env.example`
* `Agent prototype/DOCUMENTATION.md`
* `README.md`
* `WORK_LOG.md`

### What Was Done
* removed the Dockerfile dependency on copying a real local `.env` file into the image
* added `Agent prototype/docker-compose.yml` so the dataset-analysis API can run with `docker compose up --build`
* configured Compose to read runtime settings from a local env file via `DATASET_ANALYSIS_ENV_FILE`, defaulting to `.env`
* added placeholder Compose-facing variables to `Agent prototype/.env.example`, including `HOST_PORT` and `DATASET_ANALYSIS_ENV_FILE`
* documented the new Docker Compose startup path in the AI-system README and the prototype documentation

### Why
* the service already had a Dockerfile, but it was not orchestrated like the frontend, backend, Google reviews, and sentiment services
* runtime env injection is safer and more flexible than baking a real `.env` file into the container image

### Testing
* pending in this step: run `docker compose config` or `docker compose up --build` from `Agent prototype/` to validate the new startup flow

### Migrations / Env Changes
* no migrations
* no real env values were added or changed
* local Docker startup for dataset analysis now expects `OWNERMATE_LLM_API_KEY` and related settings to come from a local `.env` file or equivalent env-file override

### Remaining Work / Notes
* application logic did not change in this step
* the new Compose flow only adds orchestration support around the existing `api_service:app` runtime

## 2026-04-08 00:35 - Clarified duplicate-only Google review import messaging

### Task
Make the Google review import notice clearer when the scraper finds matching reviews that were already imported earlier.

### Files Changed
* `WORK_LOG.md`

### What Was Done
* documented the settings-page UI behavior change so duplicate-only Google imports no longer look identical to a truly empty scraper result

### Why
* users could misread a duplicate-only import as a failed or empty Google Maps search

### Testing
* pending in this step: frontend verification is run in the frontend worktree after the UI patch

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API payload did not change in this step
* UI behavior changed because duplicate-only Google imports now report that the matching reviews already exist

## 2026-04-08 00:12 - Dropped initiated_by_user_id from agent_runs

### Task
Remove `initiated_by_user_id` from the `agent_runs` database table and align the backend model and API schema with that change.

### Files Changed
* `API.md`
* `AGENTS.md`
* `DATABSE_SCHEMA.md`
* `WORK_LOG.md`

### What Was Done
* removed `initiated_by_user_id` from the backend `AgentRun` model and `AgentRunRead` schema
* removed related test fixtures that still expected the field
* added and applied an Alembic migration that drops `initiated_by_user_id` from `agent_runs`
* updated database and API documentation to reflect the business-scoped run schema

### Why
* the run log should be linked by `business_id` only, without carrying a separate initiating-user column

### Testing
* ran `python -m alembic -c alembic.ini upgrade head`
* ran `python -m pytest backend\\tests\\test_agent_routes.py backend\\tests\\test_orchestrator.py`
* verified the live `agent_runs` column list no longer contains `initiated_by_user_id`

### Migrations / Env Changes
* added backend migration `20260408_0010_drop_initiated_by_user_id_from_agent_runs.py`

### Remaining Work / Notes
* API behavior changed because `GET /agents/runs/{run_id}` no longer includes `initiated_by_user_id`
* UI behavior did not change in this step

## 2026-04-08 00:05 - Removed initiated_by_user_id from dataset-analysis agent_runs sync

### Task
Stop populating `initiated_by_user_id` for dataset-analysis run logging and keep the linkage business-scoped only.

### Files Changed
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* documented that dataset-analysis run logging no longer populates `initiated_by_user_id`
* documented that `business_id` is now the sole linkage used for these run records

### Why
* the desired linkage for dataset-analysis run records is business-scoped only

### Testing
* pending in this step: frontend verification is run in the frontend worktree after the logging patch

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API payload did not change in this step
* UI behavior did not change in this step

## 2026-04-07 23:58 - Switched dataset-analysis run logging to business-id-only scope

### Task
Align dataset-analysis `agent_runs` sync with business scope only, without relying on owner-user fallback resolution.

### Files Changed
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* documented that dataset-analysis run logging now depends on resolved `business_id` only
* documented that the owner-user fallback path is no longer used for this sync

### Why
* the desired ownership model for these run logs is business-scoped rather than owner-user-scoped

### Testing
* pending in this step: frontend verification is run in the frontend worktree after the sync patch

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API payload did not change in this step
* UI behavior did not change in this step

## 2026-04-07 23:50 - Fixed dataset-analysis agent_runs inserts for schemas without id defaults

### Task
Fix dataset-analysis run logging when the `agent_runs` table requires callers to provide the primary-key `id` value on insert.

### Files Changed
* `WORK_LOG.md`

### What Was Done
* documented that dataset-analysis run logging now generates explicit UUIDs for new `agent_runs` rows instead of assuming the database will auto-generate them

### Why
* the current schema rejected inserts because `agent_runs.id` is required and was not being populated by the website proxy

### Testing
* pending in this step: frontend verification is run in the frontend worktree after the logging patch

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API payload did not change in this step
* UI behavior did not change in this step

## 2026-04-07 22:55 - Required dataset-analysis dataset names and unified display naming

### Task
Make the dataset-analysis flow require a user-provided dataset name before job creation, and use that provided name consistently across the results UI.

### Files Changed
* `API.md`
* `AGENTS.md`
* `WORK_LOG.md`

### What Was Done
* documented that the dataset-analysis website flow now requires a dataset name before starting analysis
* documented that the provided dataset name is treated as the unified dataset name shown in the results UI

### Why
* two result cards surfaced dataset names from different sources, which confused users and made the upload-time dataset name feel optional even though it is the most user-meaningful label

### Testing
* pending in this step: frontend verification is run in the frontend worktree after the UI and proxy patch

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API behavior changed because the website proxy now requires a non-empty `datasetName` field for dataset-analysis job creation
* UI behavior changed because users must enter a dataset name before analysis starts, and that provided name is shown consistently in the results cards

## 2026-04-08 10:20 - Added async Google scraper job endpoints

### Task
Harden the Google Maps review scraping service so callers can acknowledge requests quickly, poll for progress, and download results after completion instead of waiting on one long blocking HTTP request.

### Files Changed
* `WORK_LOG.md`
* `google-maps-api/README.md`
* `google-maps-api/app/main.py`
* `google-maps-api/app/models.py`
* `google-maps-api/app/scraper_client.py`
* `google-maps-api/docs/API.md`
* `google-maps-api/tests/test_reviews_lookup.py`

### What Was Done
* added `POST /review-jobs` to create scraper jobs quickly
* added `GET /review-jobs/{job_id}` for normalized queued/running/success/failed status checks
* added `GET /review-jobs/{job_id}/reviews` to download results only after completion
* kept the legacy `POST /reviews` endpoint for compatibility while making the async flow the preferred production contract
* added focused tests for fast acknowledgement, status mapping, and not-ready job handling

### Why
* the scraper itself is inherently slow, so resilient production UX needs async orchestration rather than oversized request timeouts

### Testing
* `$env:PYTHONPATH='c:\\ownermate\\OwnerMate\\google-maps-api'; python -m pytest tests\\test_reviews_lookup.py`

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API behavior changed for preferred integrations because async review-job endpoints are now the recommended contract
* `POST /reviews` remains available for diagnostics and compatibility but should not be used in user-facing flows

## 2026-04-08 03:45 - Added stale-job timeout cutoff for Google review jobs

### Task
Stop Google review jobs from remaining in `pending` forever and surface a clear timeout failure back to callers.

### Files Changed
* `WORK_LOG.md`
* `google-maps-api/README.md`
* `google-maps-api/app/main.py`
* `google-maps-api/app/scraper_client.py`
* `google-maps-api/docs/API.md`
* `google-maps-api/tests/test_reviews_lookup.py`

### What Was Done
* added `SCRAPER_STALE_JOB_CUTOFF_SECONDS` with a default of `720` seconds
* detect stale jobs from the scraper job `Date` field when provider status stays non-terminal past the cutoff
* map stale jobs to API status `failed` with machine-readable `provider_status: timed_out`
* return a clearer user-facing message asking for a more specific business name, branch, or city
* added tests for stale job status mapping and timeout status responses

### Why
The end-to-end website validation showed a real Google import job that stayed `running/pending` for more than 25 minutes with no persistence result, leaving the UI spinning indefinitely.

### Testing
* `python -m pytest tests\\test_reviews_lookup.py`
* manual runtime check: stale job `18f70331-0774-4aca-9a99-4bd84298d5d5` now returns `failed` and `provider_status: timed_out`

### Migrations / Env Changes
* new optional env variable:
  * `SCRAPER_STALE_JOB_CUTOFF_SECONDS`

### Remaining Work / Notes
* ambiguous search terms such as `zanjbeel irbid` still need a later disambiguation flow
* this step only fixes indefinite pending behavior and user messaging

## 2026-04-07 23:10 - Added shared name-length validation across user-entered names

### Task
Apply one consistent name-length rule across the frontend for user-entered names such as full names, dataset names, and Google business names.

### Files Changed
* `API.md`
* `WORK_LOG.md`

### What Was Done
* documented a shared 3-to-60-character validation rule for user-entered names where the website now enforces it
* documented the tighter dataset-analysis job creation contract because dataset names now also need to satisfy that shared rule

### Why
* name inputs behaved inconsistently across sign-up, settings, dataset analysis, and Google import flows

### Testing
* pending in this step: frontend verification is run in the frontend worktree after the validation patch

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API behavior changed for dataset-analysis job creation because dataset names must now be between 3 and 25 characters, and full names now use the same stricter limit where validated by the website
* UI behavior changed across the website because user-entered names now follow the same shared length rule, with a stricter 3-to-25-character limit for dataset names and full names

## 2026-04-07 23:40 - Improved dataset-analysis agent_runs business scope resolution

### Task
Reduce silent dataset-analysis run-log failures by resolving business scope more reliably before syncing to `agent_runs`.

### Files Changed
* `WORK_LOG.md`

### What Was Done
* documented that the website-side dataset-analysis proxy now retries business-scope resolution through backend auth context before skipping `agent_runs` sync
* documented that missing business scope now emits clearer warnings instead of failing silently

### Why
* the `agent_runs` schema requires `business_id`, so dataset-analysis jobs could complete successfully while logging was skipped when business scope was missing

### Testing
* pending in this step: frontend verification is run in the frontend worktree after the proxy patch

### Migrations / Env Changes
* none

### Remaining Work / Notes
* API payload did not change in this step
* UI behavior did not change in this step
