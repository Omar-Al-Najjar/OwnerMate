# OwnerMate AI — Data Analysis Agent: Documentation

## Table of Contents

1. [Purpose](#1-purpose)
2. [Tech Stack](#2-tech-stack)
3. [Agentic Architecture](#3-agentic-architecture)
   - [Overview](#31-overview)
   - [The Six Agents](#32-the-six-agents)
   - [LangGraph Pipeline](#33-langgraph-pipeline)
   - [Anti-Hallucination Design](#34-anti-hallucination-design)
   - [Self-Healing & Refinement Loops](#35-self-healing--refinement-loops)
4. [Streamlit Application](#4-streamlit-application)
   - [Purpose](#41-purpose)
   - [User Flow](#42-user-flow)
   - [UI Structure](#43-ui-structure)
5. [Data Flow Diagram](#5-data-flow-diagram)
6. [Pydantic Data Models](#6-pydantic-data-models)
7. [Deployment](#7-deployment)

---

## 1. Purpose

**OwnerMate AI — Data Analysis Agent** is a fully automated, multi-agent business intelligence tool. A business owner uploads any CSV file containing their business data (sales records, transactions, customer data, inventory, etc.) and receives a complete, plain-English analysis report — with no data science knowledge required.

The system automatically:
- Understands the structure and meaning of the uploaded data
- Generates relevant analytical questions tailored to that specific dataset
- Executes real data queries and captures ground-truth results
- Translates findings into prioritised, actionable business recommendations
- Self-reviews and corrects its own output before delivering the final report

The tool is designed for **small and medium business owners** who need data-driven insight but do not have a data analyst on their team.

---

## 2. Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **LLM** | OpenAI GPT-4o | Powers all six AI agents |
| **Agent Framework** | PydanticAI | Structured, type-safe LLM agent definitions with validated outputs |
| **Orchestration** | LangGraph | Stateful multi-agent graph with conditional routing and loops |
| **Data Validation** | Pydantic v2 | Enforces strict output schemas on every agent response |
| **Data Processing** | Pandas + NumPy | DataFrame profiling, query execution, result validation |
| **Web Application** | Streamlit | Interactive frontend for file upload and result display |
| **Async Runtime** | asyncio + nest_asyncio | Async agent calls with timeout and retry support |
| **Language** | Python 3.11+ | Core implementation language |

### Key Library Roles

**PydanticAI** is used to define each agent with a strict `output_type`. This means every LLM response is automatically parsed and validated against a Pydantic model — if the model returns malformed JSON or missing fields, the call fails and retries rather than silently passing bad data downstream.

**LangGraph** provides the stateful graph runtime. The pipeline is not a simple chain — it is a directed graph with conditional edges, loops, and shared state (`MasterState`) that all agents read from and write to. This enables the manager agent to route dynamically and the refinement agent to trigger targeted re-runs.

**nest_asyncio** patches the event loop so the async pipeline can run inside Streamlit's synchronous execution context without deadlocking.

---

## 3. Agentic Architecture

### 3.1 Overview

The pipeline is structured as two nested LangGraph subgraphs compiled into a single master graph:

```
CSV Upload
    │
    ▼
┌─────────────────────────┐
│   Semantic Pipeline      │  (subgraph 1)
│   └── Semantic Agent     │
└────────────┬────────────┘
             │  semantic_model
             ▼
┌─────────────────────────────────────────────────────────┐
│   Analysis Pipeline                                      │  (subgraph 2)
│                                                          │
│   Manager ──► Question Agent ──► Manager                 │
│      │                                                   │
│      ├──────► SQL Agent ─────────► Manager               │
│      │                                                   │
│      ├──────► Insights Agent ────► Manager               │
│      │                                                   │
│      ├──────► Refinement Agent ──► Manager               │
│      │                                                   │
│      └──────► done ──► END                               │
└─────────────────────────────────────────────────────────┘
             │
             ▼
    Business Insights Report
```

All agents share a single `MasterState` TypedDict that is passed through the graph. Each node reads from the state and returns a partial update — LangGraph merges these updates automatically.

---

### 3.2 The Six Agents

#### Semantic Agent
**Input:** JSON-serialised column profile (dtypes, statistics, missing value counts)  
**Output:** `DatasetSemantics` — a structured description of every column including its inferred type, role (`id`, `time`, `feature`, `category`, `target`), description, and unit.

**Purpose:** Builds the "semantic layer" — a machine-readable understanding of the dataset that all downstream agents use as their source of truth. Prevents downstream agents from hallucinating column names by providing a validated, ground-truth schema.

**Validation:** After the LLM returns its output, `validate_semantics()` hard-checks it against the real dataframe — rejecting any hallucinated column names, missing columns, invalid primary keys, or wrong time column references.

---

#### Question Agent
**Input:** Semantic model + 5-row data sample  
**Output:** `AnalyticalQuestionsOutput` — 15+ analytical questions grouped by category, each with a priority flag and reason.

**Purpose:** Acts as a senior data analyst who studies the dataset and defines the most valuable questions to answer. It generates questions across seven analytical dimensions:
- Trend (time-based, only if a time column exists)
- Segmentation (group comparisons)
- Correlation (relationships between variables)
- Distribution (outliers, spread)
- Performance (top/bottom rankings)
- Data Quality (missing values in key columns)
- Behavioral (usage patterns)

**Constraint:** The agent is explicitly forbidden from writing SQL queries or answering the questions — its only job is question formulation.

---

#### SQL Agent
**Input:** List of questions + schema + 5-row data sample  
**Output:** `SQLAgentOutput` — for each question: a pandas expression, a placeholder result summary, and a business explanation.

**Purpose:** Writes executable pandas code for each analytical question. Questions are sent in batches of 5 to stay within context limits.

**Critical design:** The agent is instructed to write `"PENDING: result will be computed by executing the query above."` as the `result_summary` — it is explicitly forbidden from predicting or inventing numbers. After the LLM responds, the pipeline immediately executes each query against the real dataframe using `eval()` and replaces the placeholder with the actual ground-truth output.

---

#### Insights Agent
**Input:** Dataset understanding summary + all Q&A pairs with real executed results  
**Output:** `BusinessInsightsOutput` — executive summary, prioritised action items, and risk warnings.

**Purpose:** Translates raw data findings into plain-English business guidance for a non-technical owner. It is the only agent that produces user-facing content.

**Anti-hallucination:** The agent receives only `actual_result` fields (the real executed output) — never the LLM-generated `result_summary`. It is instructed to cross-check every number it writes against the actual results before including it.

---

#### Refinement Agent
**Input:** All questions, all SQL answers with real results, and the full insights report  
**Output:** `RefinementDecision` — whether to approve the output or request a targeted re-run of one specific agent, with precise feedback.

**Purpose:** Acts as a team lead who reviews the complete pipeline output for quality. It checks:
1. Whether SQL queries failed or returned empty results
2. Whether important analytical angles were missed in the questions
3. Whether the insights report accurately reflects the data (cross-checks numbers)
4. Whether recommendations are specific and actionable

**Loop prevention:** Each agent is tracked in `rerun_history`. If an agent has already been re-run once, the refinement agent's request for a second re-run is overridden and the pipeline terminates — preventing infinite loops.

---

#### Manager Agent
**Input:** Current pipeline state (which outputs exist)  
**Output:** `ManagerDecision` — which agent to run next.

**Purpose:** Orchestrates the pipeline by inspecting state at each step and deciding the next action. Its logic is deterministic based on what exists in the state:

```
questions is None          → run question_agent
answers is None            → run sql_agent
insights is None           → run insights_agent
refinement is None         → run refinement_agent
refinement.approved        → done
refinement.needs_rerun     → run target agent (once per agent max)
target already re-ran      → done
```

In practice, the manager node's logic is implemented directly in code (not via LLM) to ensure deterministic routing — the `manager_agent` LLM is available but the routing decisions are made by the `manager_node` Python function based on state inspection.

---

### 3.3 LangGraph Pipeline

The pipeline uses two compiled `StateGraph` objects nested inside a master graph.

**Semantic Subgraph** — single node, runs once:
```
semantic_layer → END
```

**Analysis Subgraph** — looping graph with conditional routing:
```
manager
  ├── question_agent → manager
  ├── sql_agent      → manager
  ├── insights_agent → manager
  ├── refinement_agent → manager
  └── __end__
```

**Master Graph** — chains both subgraphs:
```
semantic_pipeline → analysis_pipeline → END
```

All three graphs share the same `MasterState` TypedDict, so state flows seamlessly between subgraphs.

---

### 3.4 Anti-Hallucination Design

Hallucination prevention is a first-class design concern throughout the pipeline. Several mechanisms work together:

| Mechanism | Where Applied | What It Prevents |
|---|---|---|
| `validate_semantics()` | After Semantic Agent | Hallucinated column names, missing columns, invalid keys |
| `output_type` on every agent | All agents | Free-form text responses; forces structured JSON |
| `"PENDING"` placeholder rule | SQL Agent | Fabricated numbers in result summaries |
| `eval()` execution + override | SQL Node | LLM-predicted results are always replaced with real executed output |
| `actual_result` field | Insights + Refinement Agents | Only real executed data is passed; `result_summary` is never used for reporting |
| `_trim_result()` helper | Insights Node | Strips any prefix markers and extracts only the raw execution output |
| Cross-check instruction | Refinement Agent | Flags any number in the insights report that cannot be traced to an `actual_result` |

---

### 3.5 Self-Healing & Refinement Loops

**SQL self-healing (within the SQL node):**  
After the first pass, any query that failed or returned empty/NaN results is automatically retried up to 2 times. Each retry includes the original error message and specific instructions for fixing the pandas expression (e.g., how to parse dates inline, how to write correlations). This happens entirely inside the SQL node before returning to the manager.

**Refinement loop (across the full pipeline):**  
After insights are generated, the refinement agent reviews everything. If it finds issues, it triggers a targeted re-run of one specific agent with detailed feedback. The feedback is injected into the next run of that agent via the `refinement_feedback` field in state. Each agent can only be re-run once — tracked by `rerun_history` — after which the pipeline accepts the output and terminates.

**Typical execution path:**
```
manager → question_agent → manager → sql_agent → manager
→ insights_agent → manager → refinement_agent → manager
→ [optional: re-run one agent] → insights_agent → manager
→ refinement_agent → manager → done
```

---

## 4. Streamlit Application

### 4.1 Purpose

The Streamlit app (`app.py`) is the user-facing interface for the pipeline. It provides a clean, no-code experience for uploading a CSV, triggering the multi-agent analysis, and exploring the results — without any interaction with code or APIs beyond providing an OpenAI key.

The app is designed for business owners, not developers. The output is presented in plain English with no technical jargon.

The current `app.py` is also a **reference frontend shell** for handoff purposes:
- it reads model configuration from server environment variables
- it does not ask end users for provider credentials
- it renders only the public response envelope returned by `pipeline.py`
- it should be treated as the source of truth for UI states, not as the final production frontend

---

### 4.2 User Flow

```
1. User opens the app
2. User enters their OpenAI API key in the sidebar
3. User uploads a CSV file
4. App shows a data preview and basic statistics
5. User clicks "Run Analysis"
6. App shows a live progress indicator while the pipeline runs (3–8 min)
7. Results appear in 5 tabs
8. User explores insights, action items, and data findings
```

The API key is entered at runtime and never stored — users bring their own OpenAI key, making the app safe to deploy publicly.

---

### 4.3 UI Structure

The app is organised into five result tabs:

#### Tab 1 — Insights Report
The primary output tab. Contains:
- **Executive Summary** — 4-6 sentences covering the most important findings with specific numbers
- **Action Items** — colour-coded by priority (red = High, yellow = Medium, green = Low). Each item includes: what is happening, why it matters, a concrete recommendation, and expected impact. High-priority items are expanded by default.
- **Watch Out For** — 5-7 specific risk warnings with named metrics and thresholds

#### Tab 2 — Data Findings
The raw analytical results. Contains:
- Success/failure metrics (total questions, successful queries, failed queries)
- Every successful query with its pandas code, real executed result, and business explanation
- Every failed query with its error message

#### Tab 3 — Questions
The analytical questions generated for this dataset. Contains:
- Dataset understanding summary
- Questions grouped by category (Trend, Segmentation, Correlation, etc.)
- Priority questions starred and bolded with their priority reason

#### Tab 4 — Semantic Model
The structured understanding of the dataset. Contains:
- Full column table (name, inferred type, role, description, unit)
- Primary keys and time column identification
- Missing value report

#### Tab 5 — Pipeline Log
Operational transparency. Contains:
- Manager routing log (the full sequence of agent activations)
- Final refinement decision and reasoning
- Full raw agent output log (collapsed by default)

---

## 5. Data Flow Diagram

```
CSV File
    │
    ▼
profile_dataframe()
    │  column stats, dtypes, missing counts
    ▼
Semantic Agent  ──────────────────────────────────────────────►  DatasetSemantics
    │                                                                    │
    │  validate_semantics() ◄── hard-check against real df              │
    │                                                                    │
    ▼                                                                    │
Question Agent  ◄── semantic_model + 5-row sample ◄─────────────────────┘
    │
    │  15+ analytical questions
    ▼
SQL Agent  ◄── questions + schema + 5-row sample
    │
    │  pandas expressions (LLM-generated)
    ▼
eval() execution against real df
    │
    │  actual_result = real executed output (replaces LLM placeholder)
    ▼
Insights Agent  ◄── actual_result fields only (never LLM-predicted summaries)
    │
    │  executive summary + action items + warnings
    ▼
Refinement Agent  ◄── questions + actual_results + insights
    │
    ├── approved → END
    │
    └── re-run target agent (max once per agent) → loop back
```

---

## 6. Pydantic Data Models

All inter-agent communication is typed and validated via Pydantic v2 models.

```
DatasetSemantics
├── dataset_name: str
├── row_count: int
├── columns: List[ColumnSemantics]
│   ├── name: str
│   ├── dtype: "int" | "float" | "string" | "datetime" | "category"
│   ├── description: str
│   ├── unit: Optional[str]
│   ├── role: "feature" | "target" | "id" | "time" | "category"
│   └── stats: Optional[ColumnStats]
├── primary_keys: List[str]
├── time_column: Optional[str]
└── missing_values: Dict[str, int]

AnalyticalQuestionsOutput
├── dataset_understanding: str
└── questions: List[AnalyticalQuestion]
    ├── question: str
    ├── category: str
    ├── priority: bool
    └── priority_reason: Optional[str]

SQLAgentOutput
└── answers: List[QueryResult]
    ├── question: str
    ├── query: str
    ├── result_summary: str        ← overwritten with real result after execution
    ├── explanation: str
    ├── error: Optional[str]
    └── actual_result: Optional[str]  ← ground truth, set after eval()

BusinessInsightsOutput
├── executive_summary: str
├── action_items: List[ActionItem]
│   ├── title: str
│   ├── priority: "High" | "Medium" | "Low"
│   ├── what: str
│   ├── why_it_matters: str
│   ├── recommendation: str
│   └── expected_impact: str
└── watch_out_for: List[str]

RefinementDecision
├── needs_refinement: bool
├── target_agent: Optional["question_agent" | "sql_agent" | "insights_agent"]
├── failed_questions: Optional[List[str]]
├── feedback: str
└── reasoning: str

ManagerDecision
├── next_agent: "question_agent" | "sql_agent" | "insights_agent" | "refinement_agent" | "done"
└── reasoning: str
```

---

## 7. Deployment

### Local setup

1. Install the prototype dependencies:

```bash
pip install -r requirements.txt
```

2. Create a local env file from the example:

```bash
cp .env.example .env
```

3. Set at least:

```bash
OWNERMATE_LLM_API_KEY=your_provider_key
```

4. Run the reference UI shell:

```bash
streamlit run app.py
```

Windows shortcut commands from the `Agent prototype/` folder:

```powershell
.\run-prototype.ps1
```

or

```bat
run-prototype.bat
```

### Local setup notes

- The current prototype is configured through environment variables, not user-entered API keys.
- The included `.env.example` documents the supported runtime variables.
- `pipeline.py` loads `Agent prototype/.env` automatically at import time.
- Keep local `.env` files uncommitted; the repo now ignores them.
- The launcher scripts avoid needing `streamlit` on your global PATH.
- For `kimi-k2.5`, keep `OWNERMATE_LLM_TEMPERATURE=0.6` unless you intentionally switch to a model with different temperature rules.

### Local

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
streamlit run app.py
```

### Streamlit Community Cloud (recommended)

1. Push the `Agent prototype/` folder to a GitHub repository branch
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Connect your GitHub account
4. Set:
   - **Repository:** your repo
   - **Branch:** your branch
   - **Main file path:** `Agent prototype/app.py`
5. Deploy — Streamlit Cloud installs from `requirements.txt` automatically

**No secrets need to be configured on the server.** Users enter their own OpenAI API key at runtime via the sidebar. The key is only held in memory for the duration of the session.

### Requirements

```
streamlit>=1.32.0
pandas>=2.0.0
numpy>=1.24.0
pydantic>=2.0.0
pydantic-ai>=0.0.14
langgraph>=0.2.0
openai>=1.0.0
nest-asyncio>=1.5.0
```

### Runtime

- **Typical analysis time:** 3–8 minutes depending on dataset size and number of questions
- **Model:** GPT-4o (configurable in `pipeline.py`)
- **Agent timeout:** 120 seconds per agent call, with up to 3 exponential-backoff retries
- **Batch size:** 5 questions per SQL agent call

## 8. Frontend Handoff Contract

The public contract exposed by `pipeline.py` is:

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

This prototype contract is for the current CSV-analysis handoff only and is not yet the final OwnerMate product API.
