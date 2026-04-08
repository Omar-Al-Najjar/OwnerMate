# AGENTS.md
> **Note:** Put this file at the repository root.

# Agent System Design

## 1. Agentic Scope

OwnerMate uses a multi-agent or workflow-based orchestration layer to route user tasks to the correct service.

This layer is limited to the current in-scope features:
- review ingestion assistance
- sentiment analysis
- content generation
- intent routing

It explicitly excludes:
- trend analysis agents
- forecasting agents
- predictive inventory agents

## 2. Recommended Agent Roles

### 2.1 Orchestrator Agent
**Responsibilities:**
- receive task intent
- validate task type
- decide which specialized service or agent should run
- return a structured result or structured failure

### 2.2 Review Ingestion Agent
**Responsibilities:**
- coordinate source-specific review fetch flows
- normalize data into the project schema
- report ingestion results and failures

### 2.3 Sentiment Analysis Agent
**Responsibilities:**
- process single or batch reviews
- classify sentiment
- attach confidence and theme tags
- support Arabic and English workflows
- backfill missing sentiment results for imported or newly viewed reviews when no prior classification exists

### 2.4 Content Generation Agent
**Responsibilities:**
- generate review replies
- generate short marketing or engagement text
- respect selected language and tone
- return editable outputs

## 3. Optional Supporting Components

These may be implemented as services instead of independent agents if that is simpler:
- language detection helper
- prompt builder
- review summarization helper
- policy or safety guard layer

## 4. Recommended Routing Model

```text
User Action or Prompt
  -> Orchestrator
      -> Ingestion Agent
      -> Sentiment Agent
      -> Content Generation Agent
```

## 5. Suggested Task Types

* `import_reviews`
* `analyze_review`
* `analyze_review_batch`
* `generate_reply`
* `generate_marketing_copy`
* `get_review_summary`

## 6. Output Requirements

All agent outputs should be:
* structured
* typed
* debuggable
* safe for frontend rendering

**Suggested output shape:**
```json
{
  "task_type": "generate_reply",
  "status": "success",
  "data": {},
  "meta": {
    "agent": "content_generation",
    "duration_ms": 1234
  }
}
```

## 7. Failure Handling

The agent layer should fail gracefully when:
* task type is unsupported
* required input is missing
* external source ingestion fails
* sentiment model fails
* generation provider is unavailable

## 8. Guardrails

* Do not route any task to forecasting or trend modules.
* Do not create fallback predictive logic under another name.
* Keep user-facing results grounded in stored reviews and approved context.
* Preserve enough metadata for debugging and auditability.

## 9. Logging and Traceability

Each meaningful agent run should ideally log:
* task type
* selected agent
* business or user scope
* start and end time
* success or failure
* key references to inputs and outputs

### Current runtime behavior note

- newly imported reviews may be classified automatically through the sentiment analysis service after import
- reviews returned to the main application may trigger best-effort sentiment backfill when a stored sentiment result is missing
- the main backend can now use either a mock sentiment provider or the separate Dockerized sentiment model service under `Sentiment analysis model/`
- the Google Maps review-ingestion helper under `google-maps-api/` currently uses `business_name` only for business lookup

## 10. Documentation Rule for Agents

Whenever an agent is added, changed, rerouted, or removed, the coding agent must:
* update this file (`AGENTS.md`)
* update `WORK_LOG.md`
* mention whether API payloads or UI behavior changed

## 11. Implementation Note for Codex

If a task can be solved with a simple service layer before full multi-agent abstraction, that is acceptable. 

However, the documentation and code should still preserve a clear orchestration boundary so the project can scale later.

## 12. Current Prototype Boundary

The current repository also contains a **frontend handoff prototype** under `Agent prototype/`.

This prototype is intentionally limited:
- it analyzes uploaded CSV business datasets
- it does not yet implement the final OwnerMate review-ingestion workflow
- it keeps a clear orchestration boundary so the frontend can consume one stable response envelope

### Prototype orchestrator output

The prototype returns a structured envelope shaped like:

```json
{
  "task_type": "analyze_dataset",
  "status": "success | partial_success | error",
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

### Runtime note

The prototype now expects server-side environment configuration for the model provider, primarily:
- `OWNERMATE_LLM_API_KEY`
- `OWNERMATE_LLM_MODEL`
- `OWNERMATE_LLM_BASE_URL`

### Separate service note

The prototype can now be exposed through a lightweight async service wrapper inside `Agent prototype/`:
- `GET /health`
- `POST /jobs`
- `GET /jobs/{job_id}`

This wrapper:
- keeps CSV analysis out of the main OwnerMate backend
- stores short-lived job state in memory for v1
- is intended to be called only by trusted server-side proxies using an internal secret
- can localize completed job results for Arabic consumers through `GET /jobs/{job_id}?locale=ar` without rerunning the analysis

### Current UI integration note

- the website now exposes a dedicated authenticated page for this prototype under `/{locale}/dataset-analysis`
- the website reaches the prototype only through thin Next.js proxy routes
- this change affects UI behavior and frontend-facing API routes, but it does not move the dataset-analysis agent into the main backend
- the website can now rehydrate the same completed dataset-analysis job in Arabic when the locale changes, while the findings tab shows answered findings only
- the authenticated dataset-analysis proxy now mirrors prototype job lifecycle into the shared `agent_runs` table when business scope is available, so analysis runs are traceable beside the rest of the product agents
- the website now requires a user-provided dataset name before starting dataset analysis, and that provided name is the unified dataset name shown across the dataset-analysis results UI
- dataset-analysis run logging now relies on resolved `business_id` scope, and it supports schemas that require explicit `agent_runs.id` values on insert
- dataset-analysis run logging no longer populates `initiated_by_user_id`; `business_id` is the sole linkage used for these run records

### Current reliability note

- the dataset-analysis prototype now retries transient provider overload failures before returning an error
- the prototype continues to return the same structured envelope, but error `details` may now surface provider overload messages more clearly in the website UI
- the prototype runtime is also kept compatible with newer pandas string dtypes so CSV profiling does not fail before the orchestrator runs
- the prototype now normalizes pandas timestamp-like values before agent handoffs and final envelopes so long-running jobs do not fail during JSON serialization
- the prototype SQL stage now calls the SQL agent for both normal batches and retry batches, avoiding unbound local failures when no retry feedback is present
