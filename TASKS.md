# TASKS.md
# Put this file at: repository root

# Tasks and Sprint Plan

## 1. Planning Notes

This task plan is based on the provided schedule summary and gantt chart, adjusted to match the current implementation scope.

**Trend analysis and all forecasting-related work are removed.**

Each sprint includes:
- execution tasks
- subtasks
- a testing/validation phase

Black in the original chart represented sprint duration, blue represented subtasks, and red represented testing.

## 2. Sprint Overview

### Sprint 1 (Mar 17 - Mar 26)
**Foundation and Core Logic**

Focus:
- Next.js and Supabase setup
- account authentication
- intent recognition and early orchestration foundation
- initial ingestion and validation groundwork

#### Tasks
1. Project bootstrap
   - initialize frontend and backend workspaces
   - prepare Docker-based local development
   - define environment variable strategy

2. Next.js + Supabase setup
   - connect frontend to Supabase
   - configure auth client usage
   - prepare protected route handling

3. LangGraph or equivalent orchestration foundation
   - create intent routing structure
   - define initial agent contract types
   - implement base orchestration flow

4. CSV/JSON ingestion pipeline foundation
   - define review input format
   - add normalization utilities
   - validate accepted structures

5. Supabase auth and MFA implementation
   - sign in/sign up flows
   - session handling
   - role-aware auth checks

6. RAG or context retrieval groundwork if still needed for generation context
   - only include context retrieval related to reviews and content generation
   - do not include forecasting knowledge retrieval

7. Pydantic data validation
   - request schemas
   - response schemas
   - settings validation

#### Testing and Validation
- auth and routing validation
- ingestion validation
- hallucination and routing sanity checks for agent responses

### Sprint 2 (Mar 27 - Apr 12)
**Intelligence**

Focus:
- bilingual sentiment analysis
- review scrapers
- review intelligence processing

#### Tasks
1. Sentiment analysis model pipeline
   - design data flow for Arabic and English sentiment inputs
   - prepare evaluation dataset strategy
   - build labeling and inference service

2. Accuracy objective work
   - improve classification quality toward project target
   - tune preprocessing and prompt/model behavior
   - validate confidence metadata

3. Review scraper implementation
   - Google review ingestion path
   - Facebook review ingestion path
   - deduplication strategy
   - source metadata preservation

4. Review intelligence service
   - summarize pain points and praise themes
   - support batch review processing
   - surface actionable negative feedback

#### Testing and Validation
- sentiment analysis validation
- scraper validation
- source normalization testing
- bilingual edge-case testing

### Sprint 3 (Apr 13 - Apr 24)
**UI/UX and Multi-Agent System**

Focus:
- design and build the app interface
- implement multi-agent orchestration into usable frontend flows

#### Tasks
1. UI design for all in-scope features
   - login and auth screens
   - dashboard
   - reviews listing and detail pages
   - content generation page
   - settings and profile pages

2. Theme and i18n setup
   - dark/light switching
   - Arabic and English translation structure
   - RTL handling where needed

3. Multi-agent orchestration
   - route user actions to the right services
   - standardize request/response contracts
   - create user-safe error handling

4. UX refinement
   - loading states
   - empty states
   - validation and feedback messages

#### Testing and Validation
- UI and agent integration testing
- responsive testing
- theme testing
- translation and RTL validation

### Sprint 4 (Apr 27 - Apr 30)
**Integration and Content Generation**

Focus:
- integrate the working services into the website
- finalize AI content generation

#### Tasks
1. Content generation model/workflow
   - review reply generation
   - short marketing copy generation
   - bilingual output controls

2. Integrate services into frontend
   - connect sentiment endpoints
   - connect content generation endpoints
   - connect review retrieval and detail actions

3. Content editing workflow
   - editable generated output
   - copy/save/regenerate flows

#### Testing and Validation
- integration testing
- content generation testing
- prompt-output quality checks

### Sprint 5 (May 1 - May 5)
**Deployment Phase**

Focus:
- deploy the website and APIs

#### Tasks
1. Deploy agentic backend/API services
2. Deploy sentiment analysis service path
3. Deploy the website
4. configure production environment variables
5. confirm auth and database connectivity in deployment

#### Testing and Validation
- deployment smoke tests
- API health checks
- production auth validation
- end-to-end core flow testing

### Sprint 6 (May 6 - May 15)
**Finalizing and Reporting**

Focus:
- stabilize the system
- perform security checks
- complete final reporting and documentation

#### Tasks
1. security tests
   - auth checks
   - permission checks
   - secret handling review
   - input validation review

2. documentation and reporting
   - finalize implementation docs
   - finalize project report support materials
   - confirm repository setup is reproducible

3. final bug fixing and polish
   - UI cleanup
   - API cleanup
   - workflow cleanup

#### Testing and Validation
- final regression testing
- security verification
- documentation verification

## 3. Explicitly Removed Work

These tasks are removed and must not be added back unless scope changes:
- trend analysis module
- forecast page
- demand forecast sequence flow
- inventory forecasting logic
- predictive analytics dashboards
- trend-based agent specialization

## 4. Coding Agent Operating Rule

After every meaningful task completion, the agent must append an entry to `WORK_LOG.md` with:
- the task completed
- files changed
- testing done
- remaining issues

## 5. Recommended Execution Order for Codex

1. authentication and project setup
2. review data model and ingestion pipeline
3. sentiment analysis services
4. review pages and filters
5. content generation services and UI
6. agent orchestration
7. deployment and polish