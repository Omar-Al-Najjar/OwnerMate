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

## 10. Documentation Rule for Agents

Whenever an agent is added, changed, rerouted, or removed, the coding agent must:
* update this file (`AGENTS.md`)
* update `WORK_LOG.md`
* mention whether API payloads or UI behavior changed

## 11. Implementation Note for Codex

If a task can be solved with a simple service layer before full multi-agent abstraction, that is acceptable. 

However, the documentation and code should still preserve a clear orchestration boundary so the project can scale later.

## 12. Current Implementation Status

The current backend scaffolding includes an `app/agents/` package and an orchestrator placeholder to preserve the orchestration boundary.

- backend orchestration endpoints now wrap specialized services through an explicit task router
- the orchestrator validates and dispatches only these task types:
  `import_reviews`, `analyze_review`, `analyze_review_batch`, `generate_reply`, `generate_marketing_copy`, `get_review_summary`
- unsupported task names now fail through the orchestration boundary with a structured backend error instead of falling through to implicit routing behavior
- unsupported forecasting or trend tasks are intentionally not routable
- backend service abstractions now exist for sentiment analysis and content generation
- mock/dev providers are available so backend flows can be exercised without a real model provider
- direct frontend-oriented backend endpoints for reviews, sentiment, and content coexist with the orchestrator, while cross-service routing still stays behind the explicit orchestration boundary
- agent run tracking is persisted for sentiment and content service executions
- review ingestion and review summary orchestration now persist `agent_runs` as well
- direct backend endpoints now also exist for reviews, sentiment, and content while the orchestrator remains the explicit cross-service routing boundary
- no model training or real provider-specific AI integration is implemented yet
- no agent payload contracts changed beyond establishing the backend scaffold and service boundary
- no UI behavior changed in this backend-foundation step
